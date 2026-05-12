const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('tiny', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Rate limit nas rotas de auth para prevenir brute force
app.use('/api/auth/login', rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em instantes.' },
}));

app.use('/api', routes);

// 404
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// Error handler global (sempre por último)
app.use(errorMiddleware);

module.exports = app;
