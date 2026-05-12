const ticketService = require('../services/ticket.service');
const exportService = require('../services/export.service');
const { badRequest } = require('../utils/errors');
const logger = require('../utils/logger');

/** POST /tickets/preview - aceita texto bruto e devolve preview parseado */
async function preview(req, res, next) {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) throw badRequest('Texto vazio');
    const result = ticketService.previewParse(text);
    logger.info({
      blocks: result.totals.blocks,
      warnings: result.totals.withWarnings,
    }, 'Preview executado');
    res.json(result);
  } catch (e) { next(e); }
}

/** POST /tickets/preview-file - aceita upload e devolve preview */
async function previewFile(req, res, next) {
  try {
    if (!req.file) throw badRequest('Arquivo não enviado');
    const { originalname, buffer, size } = req.file;
    const lower = originalname.toLowerCase();

    let text = null;
    let structured = null;

    if (lower.endsWith('.txt')) {
      text = buffer.toString('utf8');
    } else if (lower.endsWith('.csv')) {
      const parsed = ticketService.parseCsvBuffer(buffer);
      if (parsed.mode === 'raw') text = parsed.text;
      else structured = parsed.rows;
    } else if (lower.endsWith('.xlsx')) {
      const parsed = await ticketService.parseXlsxBuffer(buffer);
      if (parsed.mode === 'raw') text = parsed.text;
      else structured = parsed.rows;
    } else {
      throw badRequest('Formato não suportado');
    }

    let result;
    if (text !== null) {
      result = ticketService.previewParse(text);
    } else {
      // dados estruturados
      const tickets = structured.map((row) => ticketService.rowToTicket(row));
      // Renormaliza tecnologia/grupo a partir do parser quando possível
      const { normalizers } = require('../parsers');
      for (const t of tickets) {
        if (!t.technology && t.system) t.technology = normalizers.mapTechnology(t.system);
        if (!t.solverGroup) t.solverGroup = normalizers.detectSolverGroup([t.responders, t.description].join(' '));
        if (!t.operatingSystem) t.operatingSystem = 'Linux/Unix';
        if (t.rawDate && !t.date) t.date = normalizers.parseDateLoose(t.rawDate);
      }
      result = {
        tickets,
        logs: [],
        totals: { blocks: tickets.length, parsed: tickets.length, withWarnings: 0 },
      };
    }

    res.json({ ...result, fileName: originalname, fileSize: size });
  } catch (e) { next(e); }
}

/** POST /tickets - persistir lote */
async function save(req, res, next) {
  try {
    const { tickets, source = 'paste', fileName = null, rawSize = 0, notes = null, parseErrors = 0 } = req.body || {};
    if (!Array.isArray(tickets) || tickets.length === 0) throw badRequest('Lista de tickets vazia');
    const result = await ticketService.persistTickets({
      tickets, source, fileName, rawSize, notes, parseErrors,
      userId: req.user?.id || null,
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
}

/** GET /tickets */
async function list(req, res, next) {
  try {
    const result = await ticketService.listTickets(req.query);
    res.json(result);
  } catch (e) { next(e); }
}

/** GET /tickets/:id */
async function getOne(req, res, next) {
  try {
    const t = await ticketService.getTicket(req.params.id);
    if (!t) return res.status(404).json({ error: 'Não encontrado' });
    res.json(t);
  } catch (e) { next(e); }
}

/** PATCH /tickets/:id */
async function update(req, res, next) {
  try {
    const t = await ticketService.updateTicket(req.params.id, req.body);
    res.json(t);
  } catch (e) { next(e); }
}

/** DELETE /tickets/:id */
async function remove(req, res, next) {
  try {
    await ticketService.deleteTicket(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
}

/** POST /tickets/export?format=xlsx|csv  - recebe array de tickets no body */
async function exportTickets(req, res, next) {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    let tickets = req.body?.tickets;

    // Se body vier vazio, exporta TODOS do banco (com filtros opcionais)
    if (!Array.isArray(tickets) || tickets.length === 0) {
      const { items } = await ticketService.listTickets({ ...req.query, pageSize: 10000, page: 1 });
      tickets = items;
    }

    if (format === 'csv') {
      const buf = exportService.exportCsv(tickets);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="opsreport.csv"');
      return res.send(buf);
    }

    const buf = await exportService.exportXlsx(tickets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="opsreport.xlsx"');
    res.send(Buffer.from(buf));
  } catch (e) { next(e); }
}

module.exports = {
  preview, previewFile, save, list, getOne, update, remove, exportTickets,
};
