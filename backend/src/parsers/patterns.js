/**
 * patterns.js - Expressões regulares e listas usadas pelo parser.
 *
 * Filosofia: cada padrão é exportado nominalmente para que novos formatos
 * possam ser adicionados sem editar a lógica do parser.
 */

// ID do chamado: #123456 (5 a 8 dígitos, mas aceita 3+)
const TICKET_ID = /#\s*(\d{3,12})/;

// Datas: "30/03", "30/03/2025", "30-03-2025", "2025-03-30"
const DATE_PATTERNS = [
  /\b(\d{4})-(\d{2})-(\d{2})\b/, // ISO: 2025-03-30
  /\b(\d{2})\/(\d{2})\/(\d{4})\b/, // 30/03/2025
  /\b(\d{2})-(\d{2})-(\d{4})\b/, // 30-03-2025
  /\b(\d{2})\/(\d{2})\b/, // 30/03 (sem ano)
];

// Header inline (estilo "PRD | MOVEL | MSE brux1044")
// Captura environment, segment, system e opcionalmente hostname colado
const INLINE_HEADER =
  /\b(PRD|PROD|HML|DEV|UAT)\b\s*\|\s*([A-Z][A-Z0-9_\-]*)\s*\|\s*([A-Z][A-Z0-9_]*)\s*([A-Za-z0-9_\-]+)?/;

// Hostname: padrões observados no usuário
// Ex: BRUX1047, BRUX1608, CLMSELX7352, CLNETSMSLX6445
// Regra: 2+ letras maiúsculas + opcionalmente mais letras + 3+ dígitos no final
const HOSTNAME = /\b([A-Z]{2,}[A-Z0-9]*?\d{3,})\b/i;
// Lista de "falsos positivos" comuns (PRD não é host, P1 não é host, etc.)
const HOSTNAME_BLOCKLIST = new Set([
  'PRD', 'PROD', 'HML', 'DEV', 'UAT', 'MOVEL', 'FIXO',
  'MSE', 'BPEL', 'OSB', 'EDOC', 'SPG', 'WPP',
  'P1', 'P2', 'P3', 'P4', 'P5',
]);

// Sistemas conhecidos (case-insensitive na detecção)
const KNOWN_SYSTEMS = ['MSE', 'BPEL', 'OSB', 'EDOC', 'SPG', 'WPP', 'COCKPIT'];

// COTI INFORMA - Alerta Crítico (formato Orquestrador/Cockpit)
// Ex: "COTI INFORMA - ALERTA CRITICO - PDST-2491660"
const COTI_INFORMA = /COTI\s+INFORMA\s*[-–]\s*ALERTA\s+CR[IÍ]TICO\s*[-–]\s*([\w\-]+)/i;

// Linha de alarme da tabela do Cockpit
// Ex: "3401\tERROR\tapplication\tcockpit-backend-rest-...\tListar..."
const COTI_ALARM_ROW = /^(\d{3,5})\s+(ERROR|WARN(?:ING)?|INFO|CRITICAL)\s+(application|system)\s+(\S+)/im;

// Prioridade: P1..P5 (com ou sem espaço/contexto)
const PRIORITY = /\bP([1-5])\b/;
const PRIORITY_LABELED = /Priority[^\n]*\n\s*P([1-5])/i;

// Status (busca textual)
const STATUS_KEYWORDS = [
  { match: /normalizado/i, value: 'Resolvido' },
  { match: /sem atua[cç][aã]o/i, value: 'Resolvido' },
  { match: /encaminhar para equipe respons[aá]vel/i, value: 'Direcionado' },
  { match: /em monitoramento/i, value: 'Em Monitoramento' },
  { match: /resolved/i, value: 'Resolvido' },
  { match: /\bopen\b/i, value: 'Aberto' },
  { match: /closed/i, value: 'Resolvido' },
  { match: /aberto/i, value: 'Aberto' },
];

// Restart
const RESTART = /\b(restart|reinicia[dr]o?|reboot)\b/i;

// Grupo solucionador
const SOLVER_INTEGRACAO = /(prod[\s\.\-_]integra[cç][aã]o|prod[-_\.]integracao)/i;

// Responders block (multiline)
const RESPONDERS_BLOCK = /Responders\s*\n([^\n]+(?:\n(?!(?:[\u{1F300}-\u{1FAFF}]|\w+\s*:)).+)*)/u;
// Tags block
const TAGS_BLOCK = /Tags\s*\n([^\n]+)/i;
// Description block (até próxima seção)
const DESCRIPTION_BLOCK = /Description\s*\n([\s\S]+?)(?=\n\s*(?:URLs?\s+Ativas?|Tags|Responders|Priority|Status|Alert|#\d{3,}|$))/i;
// URLs (qualquer URL no texto)
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g;

// Block splitter: separa múltiplos chamados.
// Estratégias: linha em branco dupla, "Alert" no início de linha, "#NNNN: ..."
const BLOCK_SEPARATORS = [
  /\n\s*\n(?=\s*(?:Alert\b|\d{2}\/\d{2}[^\n]*Alert|#\d{3,}))/,
  /\n(?=\s*Alert\b\s*\n\s*#\d{3,})/,
];

module.exports = {
  TICKET_ID,
  DATE_PATTERNS,
  INLINE_HEADER,
  HOSTNAME,
  HOSTNAME_BLOCKLIST,
  KNOWN_SYSTEMS,
  PRIORITY,
  PRIORITY_LABELED,
  STATUS_KEYWORDS,
  RESTART,
  SOLVER_INTEGRACAO,
  RESPONDERS_BLOCK,
  TAGS_BLOCK,
  DESCRIPTION_BLOCK,
  URL_PATTERN,
  BLOCK_SEPARATORS,
  COTI_INFORMA,
  COTI_ALARM_ROW,
};
