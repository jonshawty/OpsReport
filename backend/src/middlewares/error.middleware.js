const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  // Erros de validação Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validação falhou',
      details: err.issues,
    });
  }

  // Erros conhecidos do Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado', details: err.meta });
  }

  logger.error({ err, path: req.path, method: req.method }, 'Erro não tratado');
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

module.exports = errorMiddleware;
