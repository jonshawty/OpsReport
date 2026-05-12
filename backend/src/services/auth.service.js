const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { signToken } = require('../utils/jwt');
const { badRequest, unauthorized } = require('../utils/errors');

async function login({ email, password }) {
  if (!email || !password) throw badRequest('Email e senha são obrigatórios');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized('Credenciais inválidas');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw unauthorized('Credenciais inválidas');

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

async function register({ email, password, name }) {
  if (!email || !password) throw badRequest('Email e senha são obrigatórios');
  if (password.length < 6) throw badRequest('Senha deve ter ao menos 6 caracteres');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw badRequest('Email já cadastrado');

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hash, name: name || email.split('@')[0] },
  });

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

module.exports = { login, register };
