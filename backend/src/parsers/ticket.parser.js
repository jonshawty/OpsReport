/**
 * ticket.parser.js - Orquestração do parsing.
 *
 * Pipeline:
 *  1. splitBlocks(text) -> array de blocos brutos
 *  2. parseBlock(block) -> objeto Ticket
 *
 * Para adicionar suporte a um novo formato, basta adicionar uma função
 * extract<X>() e chamá-la em parseBlock() respeitando fallbacks.
 */

const P = require('./patterns');
const {
  mapTechnology,
  normalizeStatus,
  detectSolverGroup,
  parseDateLoose,
  DEFAULT_OS,
} = require('./normalizers');

/**
 * Divide o texto bruto em blocos de chamados.
 * Estratégia em camadas: primeiro tenta separar por "Alert" + #ID,
 * depois por linhas em branco antes de "#ID:".
 */
function splitBlocks(rawText) {
  if (!rawText || !rawText.trim()) return [];

  // Normaliza quebras de linha
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Estratégia 1: cada bloco começa com "Alert" (multiline) ou contém um único "#NNNN:"
  // Vamos usar uma abordagem mista: dividir por linhas em branco e juntar blocos
  // que claramente continuam (multilinha com Priority/Status/Responders/Description).

  // Primeiro, vamos dividir em "chunks" por duplas quebras de linha
  const chunks = text.split(/\n\s*\n+/);

  // Agora reagrupar: um bloco "abre" com presença de "#NNN:" ou "Alert"
  // e pode continuar absorvendo chunks até encontrar o próximo abertura.
  const blocks = [];
  let buffer = [];

  const isBlockStart = (chunk) => {
    return /(^|\n)\s*Alert\b/i.test(chunk) ||
           /#\s*\d{3,}/.test(chunk) ||
           /^\d{2}\/\d{2}/.test(chunk.trim());
  };

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;

    if (isBlockStart(chunk) && buffer.length > 0 &&
        // se o chunk atual tem seu próprio "#ID", começa novo bloco
        /#\s*\d{3,}/.test(chunk)) {
      blocks.push(buffer.join('\n\n').trim());
      buffer = [chunk];
    } else if (buffer.length === 0) {
      buffer.push(chunk);
    } else {
      // continuação do bloco anterior
      buffer.push(chunk);
    }
  }
  if (buffer.length > 0) blocks.push(buffer.join('\n\n').trim());

  return blocks.filter(b => b.length > 0);
}

function extractTicketId(text) {
  const m = text.match(P.TICKET_ID);
  return m ? `#${m[1]}` : null;
}

function extractRawDate(text) {
  for (const re of P.DATE_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

function extractInlineHeader(text) {
  const m = text.match(P.INLINE_HEADER);
  if (!m) return {};
  const [, env, segment, system, maybeHost] = m;
  const result = {
    environment: env ? env.toUpperCase() : null,
    segment: segment ? segment.toUpperCase() : null,
    system: system ? system.toUpperCase() : null,
  };
  // maybeHost pode ser hostname ou ruído; valida via heurística
  if (maybeHost && /\d{3,}/.test(maybeHost) && !P.HOSTNAME_BLOCKLIST.has(maybeHost.toUpperCase())) {
    result.hostname = maybeHost.toUpperCase();
  }
  return result;
}

function extractHostname(text) {
  // Tenta encontrar múltiplos candidatos e escolher o melhor
  const lines = text.split('\n');
  // 1) Procurar em seções "Entidades Raiz" / "Hosts" / "Servidores"
  const entitiesSection = text.match(/Entidades\s+Ra[ií]z[^\n]*\n([\s\S]+?)(?=\n\s*(?:Informa|URLs?|Tags|$))/i);
  if (entitiesSection) {
    const inner = entitiesSection[1];
    const m = inner.match(/[\*\-•]?\s*([A-Z][A-Z0-9]+\d{3,})/);
    if (m) return m[1].toUpperCase();
  }

  // 2) Regex global no texto inteiro
  const matches = [...text.matchAll(/\b([A-Z]{2,}[A-Z0-9]*?\d{3,})\b/g)];
  for (const m of matches) {
    const candidate = m[1].toUpperCase();
    if (P.HOSTNAME_BLOCKLIST.has(candidate)) continue;
    // Hostnames têm pelo menos 6 chars geralmente; descarte muito curtos
    if (candidate.length < 5) continue;
    return candidate;
  }

  // 3) também buscar versões com case-insensitive (ex: brux1044)
  const ci = text.match(/\b([a-z]{2,}[a-z0-9]*?\d{3,})\b/i);
  if (ci) {
    const cand = ci[1].toUpperCase();
    if (!P.HOSTNAME_BLOCKLIST.has(cand) && cand.length >= 5) return cand;
  }

  return null;
}

function extractPriority(text) {
  // Prefere bloco "Priority\nP1"
  const labeled = text.match(P.PRIORITY_LABELED);
  if (labeled) return `P${labeled[1]}`;
  // Fallback: P1..P5 isolado
  const inline = text.match(/(?:^|\W)P([1-5])(?:\W|$)/);
  return inline ? `P${inline[1]}` : null;
}

function extractStatus(text) {
  const status = normalizeStatus(text, P.STATUS_KEYWORDS);
  if (status) return status;
  // Detecta padrão "Status\nOpen|Closed"
  const m = text.match(/Status\s*\n\s*([A-Za-zÀ-ú\s]+)/i);
  if (m) {
    const value = m[1].trim().split('\n')[0];
    const normalized = normalizeStatus(value, P.STATUS_KEYWORDS);
    return normalized || value;
  }
  return null;
}

function extractResponders(text) {
  const m = text.match(/Responders\s*\n\s*([^\n]+)/i);
  return m ? m[1].trim() : null;
}

function extractTags(text) {
  const m = text.match(P.TAGS_BLOCK);
  return m ? m[1].trim() : null;
}

function extractDescription(text) {
  // Caso multilinha com seção "Description"
  const m = text.match(P.DESCRIPTION_BLOCK);
  if (m) {
    return m[1].trim().replace(/\n{3,}/g, '\n\n');
  }

  // Caso inline: tudo após "#NNN: ENV | SEG | SYS host -" é descrição
  const inline = text.match(/#\s*\d+\s*:[^\n]+?[\-—]\s*(.+)/);
  if (inline) return inline[1].trim();

  return null;
}

function extractUrls(text) {
  const urls = text.match(P.URL_PATTERN);
  return urls ? urls.join('\n') : null;
}

function detectSegment(text) {
  // Já é coberto pelo inline header, mas tenta busca extra
  const m = text.match(/\b(MOVEL|FIXO|RESIDENCIAL|EMPRESARIAL|CORP|B2B|B2C)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function detectSystem(text) {
  const upper = text.toUpperCase();
  for (const sys of P.KNOWN_SYSTEMS) {
    // boundary
    const re = new RegExp(`\\b${sys}\\b`);
    if (re.test(upper)) return sys;
  }
  return null;
}

function detectEnvironment(text) {
  const m = text.match(/\b(PRD|PROD|HML|DEV|UAT|HOMOLOG|PRODU[CÇ][AÃ]O)\b/i);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if (v.startsWith('PROD') || v === 'PRD') return 'PRD';
  if (v.startsWith('HOMOLOG') || v === 'HML') return 'HML';
  return v;
}

/**
 * Detecta e extrai dados de chamados no formato COTI INFORMA - ALERTA CRITICO.
 * Ex:
 *   COTI INFORMA - ALERTA CRITICO - PDST-2491660
 *   ITOPS_PROD WEB Conseguem apoiar?
 *   ORQUESTRADOR - COCKPIT - PROD.INTEGRACAO / brux1573 ( Weblogic )
 *   Alarmes (1)
 *   3401   ERROR   application   cockpit-backend-rest-1.5.0_08-SNAPSHOT   ...
 * Retorna objeto com campos extraídos, ou null se não for esse formato.
 */
function extractCotiInforma(text) {
  if (!P.COTI_INFORMA.test(text)) return null;

  // ID do chamado: pode vir como PDST-2491660 (sem #) ou #NNN
  const cotiMatch = text.match(P.COTI_INFORMA);
  const rawId = cotiMatch ? cotiMatch[1] : null;
  // Normaliza: se vier como PDST-2491660 usa como está; se tiver só dígitos adiciona #
  const ticketId = rawId
    ? (/^\d+$/.test(rawId) ? `#${rawId}` : rawId)
    : null;

  // Hostname: ex "brux1573" na linha do ORQUESTRADOR
  const hostLine = text.match(/ORQUESTRADOR[^\n]*\/\s*([A-Za-z0-9]+\d{3,})/i);
  const hostname = hostLine ? hostLine[1].toUpperCase() : extractHostname(text);

  // Ambiente: PROD dentro da linha do Orquestrador
  const envMatch = text.match(/PROD[.\s_-]?INTEGRA[CÇ][AÃ]O|PROD[.\s_-]?WEB/i);
  const environment = 'PRD';

  // Grupo solucionador
  const solverGroup = /PROD[.\s_-]?INTEGRA[CÇ][AÃ]O/i.test(text)
    ? 'Prod-Integracao'
    : 'Prod-Web';

  // Sistema: COCKPIT
  const system = 'COCKPIT';
  const technology = 'Weblogic';

  // Alarme da tabela
  const alarmRow = text.match(P.COTI_ALARM_ROW);
  let description = '';
  if (alarmRow) {
    const [, alarmCode, level, , appName] = alarmRow;
    // Pega "Aplicação indisponível" e instrução da mesma linha ou linhas seguintes
    const alarmLine = text.slice(text.search(P.COTI_ALARM_ROW));
    const appUnavailable = alarmLine.match(/Aplica[cç][aã]o\s+indispon[ií]vel/i);
    const instrucao = alarmLine.match(/Verifique\s+\S+/i);
    const acionamento = alarmLine.match(/Acione\s+[^\n]+/i);
    description = `[COTI INFORMA] Código ${alarmCode} | Nível ${level} | App: ${appName}`;
    if (appUnavailable) description += ` | ${appUnavailable[0]}`;
    if (instrucao) description += ` | ${instrucao[0]}`;
    if (acionamento) description += ` | ${acionamento[0].trim()}`;
  } else {
    // Fallback: pega linhas de contexto relevantes
    const lines = text.split('\n').filter(l => l.trim() && !/^(COTI|ITOPS|ORQUESTRADOR|Alarmes|Código)/i.test(l.trim()));
    description = `[COTI INFORMA] ${lines.slice(0, 3).join(' | ')}`.trim();
  }

  // Status: por padrão Aberto (é um alerta crítico)
  const status = 'Aberto';
  const priority = 'P1';

  return {
    ticketId,
    rawDate: extractRawDate(text),
    environment,
    segment: null,
    system,
    technology,
    hostname,
    priority,
    status,
    responders: 'ITOPS_PROD',
    tags: 'COTI INFORMA',
    description,
    urls: extractUrls(text),
    operatingSystem: DEFAULT_OS,
    rawText: text,
    solverGroup,
    isRestart: false,
    isCotiInforma: true,
  };
}


function parseBlock(block) {
  const errors = [];

  // Tenta formato COTI INFORMA primeiro
  const coti = extractCotiInforma(block);
  if (coti) {
    coti.date = parseDateLoose(coti.rawDate);
    if (!coti.ticketId) errors.push('ID do chamado não encontrado');
    return { ticket: coti, errors };
  }

  const header = extractInlineHeader(block);

  const ticket = {
    ticketId: extractTicketId(block),
    rawDate: extractRawDate(block),
    environment: header.environment || detectEnvironment(block),
    segment: header.segment || detectSegment(block),
    system: header.system || detectSystem(block),
    hostname: header.hostname || extractHostname(block),
    priority: extractPriority(block),
    status: extractStatus(block),
    responders: extractResponders(block),
    tags: extractTags(block),
    description: extractDescription(block),
    urls: extractUrls(block),
    operatingSystem: DEFAULT_OS,
    rawText: block,
  };

  // Pós-processamento
  ticket.date = parseDateLoose(ticket.rawDate);
  ticket.technology = mapTechnology(ticket.system);
  // Solver group: usa responders + texto completo (responders tem prioridade)
  ticket.solverGroup = detectSolverGroup(
    [ticket.responders || '', block].join(' ')
  );
  ticket.isRestart = P.RESTART.test(block);

  // Validações leves (log de parsing)
  if (!ticket.ticketId) errors.push('ID do chamado não encontrado');
  if (!ticket.system) errors.push('Sistema não identificado');
  if (!ticket.hostname) errors.push('Hostname não identificado');

  return { ticket, errors };
}

/**
 * API principal. Recebe texto bruto, retorna { tickets, logs }.
 */
function parseRawText(rawText) {
  const blocks = splitBlocks(rawText);
  const tickets = [];
  const logs = [];

  blocks.forEach((block, idx) => {
    const { ticket, errors } = parseBlock(block);
    tickets.push(ticket);
    if (errors.length > 0) {
      logs.push({
        blockIndex: idx,
        ticketId: ticket.ticketId,
        warnings: errors,
      });
    }
  });

  return {
    tickets,
    logs,
    totals: {
      blocks: blocks.length,
      parsed: tickets.length,
      withWarnings: logs.length,
    },
  };
}

module.exports = {
  parseRawText,
  parseBlock,
  splitBlocks,
  // expostos para testes/expansão
  extractors: {
    extractTicketId,
    extractRawDate,
    extractInlineHeader,
    extractHostname,
    extractPriority,
    extractStatus,
    extractResponders,
    extractTags,
    extractDescription,
    extractUrls,
    detectSegment,
    detectSystem,
    detectEnvironment,
  },
};
