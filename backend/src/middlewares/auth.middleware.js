const { verifyToken } = require('../utils/jwt');
const { unauthorized } = require('../utils/errors');

function authMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Token não fornecido'));
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch (e) {
    return next(unauthorized('Token inválido ou expirado'));
  }
}

module.exports = authMiddleware;
