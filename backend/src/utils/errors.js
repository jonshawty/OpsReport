class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function badRequest(message, details) {
  return new ApiError(400, message, details);
}

function unauthorized(message = 'Não autenticado') {
  return new ApiError(401, message);
}

function forbidden(message = 'Acesso negado') {
  return new ApiError(403, message);
}

function notFound(message = 'Recurso não encontrado') {
  return new ApiError(404, message);
}

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound };
