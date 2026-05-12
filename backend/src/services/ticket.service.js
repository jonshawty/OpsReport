const prisma = require('../utils/prisma');
const { parseRawText } = require('../parsers');
const Papa = require('papaparse');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

/**
 * Processa texto bruto e retorna preview SEM salvar no banco.
 * Útil para o usuário revisar antes de confirmar.
 */
function previewParse(rawText) {
  const result = parseRawText(rawText);
  return result;
}

/**
 * Cria um Import + persiste todos os tickets em transação.
 * tickets: array já validado vindo do front (possivelmente editado).
 */
async function persistTickets({ tickets, source, fileName, rawSize, userId, parseErrors = 0, notes }) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    throw new Error('Nenhum ticket para salvar');
  }

  const result = await prisma.$transaction(async (tx) => {
    const imp = await tx.import.create({
      data: {
        source,
        fileName: fileName || null,
        rawSize: rawSize || 0,
        ticketCount: tickets.length,
        parseErrors,
        notes: notes || null,
        userId: userId || null,
      },
    });

    const created = await tx.ticket.createMany({
      data: tickets.map((t) => ({
        ticketId: t.ticketId || null,
        date: t.date ? new Date(t.date) : null,
        rawDate: t.rawDate || null,
        environment: t.environment || null,
        segment: t.segment || null,
        system: t.system || null,
        hostname: t.hostname || null,
        technology: t.technology || null,
        operatingSystem: t.operatingSystem || 'Linux/Unix',
        description: t.description || null,
        status: t.status || null,
        priority: t.priority || null,
        responders: t.responders || null,
        tags: t.tags || null,
        urls: t.urls || null,
        solverGroup: t.solverGroup || null,
        isRestart: !!t.isRestart,
        analyst: t.analyst || null,
        rawText: t.rawText || null,
        importId: imp.id,
      })),
    });

    return { importId: imp.id, count: created.count };
  });

  logger.info({ importId: result.importId, count: result.count }, 'Tickets persistidos');
  return result;
}

/**
 * Lista tickets com filtros + paginação.
 */
async function listTickets({ q, system, hostname, ticketId, dateFrom, dateTo, page = 1, pageSize = 25 }) {
  const where = {};
  if (q) {
    where.OR = [
      { ticketId: { contains: q, mode: 'insensitive' } },
      { hostname: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { system: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (system) where.system = { equals: system, mode: 'insensitive' };
  if (hostname) where.hostname = { contains: hostname, mode: 'insensitive' };
  if (ticketId) where.ticketId = { contains: ticketId, mode: 'insensitive' };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const take = Math.min(parseInt(pageSize, 10) || 25, 200);
  const skip = ((parseInt(page, 10) || 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.ticket.count({ where }),
  ]);

  return { items, total, page: +page, pageSize: take };
}

async function getTicket(id) {
  return prisma.ticket.findUnique({ where: { id } });
}

async function updateTicket(id, data) {
  const allowed = [
    'ticketId', 'date', 'rawDate', 'environment', 'segment', 'system',
    'hostname', 'technology', 'operatingSystem', 'description', 'status',
    'priority', 'responders', 'tags', 'urls', 'solverGroup', 'isRestart',
    'analyst',
  ];
  const patch = {};
  for (const k of allowed) {
    if (data[k] !== undefined) patch[k] = k === 'date' && data[k] ? new Date(data[k]) : data[k];
  }
  return prisma.ticket.update({ where: { id }, data: patch });
}

async function deleteTicket(id) {
  await prisma.ticket.delete({ where: { id } });
}

/**
 * Parse de arquivo CSV - retorna texto colado equivalente ou linhas estruturadas
 */
function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  // Se vier com colunas estruturadas, retorna direto como tickets
  if (parsed.meta.fields && parsed.meta.fields.length > 1) {
    return { mode: 'structured', rows: parsed.data, errors: parsed.errors };
  }
  // Caso contrário, junta tudo como texto bruto
  return { mode: 'raw', text, errors: parsed.errors };
}

async function parseXlsxBuffer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { mode: 'raw', text: '' };
  const rows = [];
  const headers = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) {
      row.eachCell((cell) => headers.push(String(cell.value || '').trim()));
      return;
    }
    const obj = {};
    row.eachCell((cell, colNum) => {
      const key = headers[colNum - 1] || `col_${colNum}`;
      obj[key] = cell.value;
    });
    rows.push(obj);
  });
  // Se a planilha já tem colunas reconhecíveis, usa modo structured.
  // Caso contrário (uma coluna só), trata como texto bruto.
  if (headers.length > 1) {
    return { mode: 'structured', rows };
  }
  const text = rows.map((r) => Object.values(r).join(' ')).join('\n\n');
  return { mode: 'raw', text };
}

/**
 * Converte uma linha "structured" (vinda de CSV/XLSX) num ticket parcial.
 */
function rowToTicket(row) {
  const get = (...keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase());
      if (found && row[found] !== null && row[found] !== '') return String(row[found]);
    }
    return null;
  };

  return {
    ticketId: get('ticketId', 'id', 'chamado', 'alert', 'numero'),
    rawDate: get('date', 'data', 'rawDate'),
    environment: get('environment', 'ambiente'),
    segment: get('segment', 'segmento'),
    system: get('system', 'sistema'),
    hostname: get('hostname', 'host', 'servidor'),
    technology: get('technology', 'tecnologia'),
    operatingSystem: get('operatingSystem', 'so', 'sistema operacional') || 'Linux/Unix',
    description: get('description', 'descricao', 'descrição'),
    status: get('status'),
    priority: get('priority', 'prioridade'),
    responders: get('responders', 'solucionador'),
    tags: get('tags'),
    urls: get('urls', 'url'),
    solverGroup: get('solverGroup', 'grupo solucionador', 'grupoSolucionador'),
    isRestart: /restart|reinicia/i.test(get('description', 'descricao') || ''),
  };
}

module.exports = {
  previewParse,
  persistTickets,
  listTickets,
  getTicket,
  updateTicket,
  deleteTicket,
  parseCsvBuffer,
  parseXlsxBuffer,
  rowToTicket,
};
