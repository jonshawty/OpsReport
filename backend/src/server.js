require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info(`🚀 OpsReport API ouvindo na porta ${PORT}`);
});

function shutdown(signal) {
  logger.info(`Recebido ${signal}, encerrando...`);
  server.close(() => {
    logger.info('HTTP server fechado.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
});
