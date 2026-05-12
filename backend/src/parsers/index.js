/**
 * Barrel export do módulo de parsing.
 * Os consumidores devem importar daqui, não dos arquivos internos.
 */
const parser = require('./ticket.parser');
const patterns = require('./patterns');
const normalizers = require('./normalizers');

module.exports = {
  ...parser,
  patterns,
  normalizers,
};
