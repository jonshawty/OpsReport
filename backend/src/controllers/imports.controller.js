const importsService = require('../services/imports.service');

async function list(req, res, next) {
  try {
    res.json(await importsService.listImports(req.query));
  } catch (e) { next(e); }
}

async function tickets(req, res, next) {
  try {
    const items = await importsService.getImportTickets(req.params.id);
    res.json({ items, total: items.length });
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    await importsService.deleteImport(req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
}

module.exports = { list, tickets, remove };
