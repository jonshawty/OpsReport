const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (e) { next(e); }
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (e) { next(e); }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, register, me };
