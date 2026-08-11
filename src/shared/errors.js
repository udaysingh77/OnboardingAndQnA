// ==================================================================
// Error factories (function-based). Each returns a real Error instance
// shaped for the central handler:
//   - isOperational: safe to show the message to the client.
//   - errorCode: stable machine-readable code (not HTTP status).
// ==================================================================
import httpStatus from 'http-status-codes';

function makeAppError(name, message, { statusCode, errorCode, details, cause } = {}) {
  const err = new Error(message, cause ? { cause } : undefined);
  err.name = name;
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  err.details = details;
  err.isOperational = true;
  Error.captureStackTrace?.(err, makeAppError);
  return err;
}

export function appError(
  message,
  { statusCode = httpStatus.INTERNAL_SERVER_ERROR, errorCode = 'INTERNAL_ERROR', details, cause } = {},
) {
  return makeAppError('AppError', message, { statusCode, errorCode, details, cause });
}

export function badRequestError(message = 'Bad request', opts = {}) {
  return makeAppError('BadRequestError', message, {
    statusCode: httpStatus.BAD_REQUEST,
    errorCode: 'BAD_REQUEST',
    ...opts,
  });
}

export function unauthorizedError(message = 'Unauthorized', opts = {}) {
  return makeAppError('UnauthorizedError', message, {
    statusCode: httpStatus.UNAUTHORIZED,
    errorCode: 'UNAUTHORIZED',
    ...opts,
  });
}

export function forbiddenError(message = 'Forbidden', opts = {}) {
  return makeAppError('ForbiddenError', message, {
    statusCode: httpStatus.FORBIDDEN,
    errorCode: 'FORBIDDEN',
    ...opts,
  });
}

export function notFoundError(message = 'Resource not found', opts = {}) {
  return makeAppError('NotFoundError', message, {
    statusCode: httpStatus.NOT_FOUND,
    errorCode: 'NOT_FOUND',
    ...opts,
  });
}

export function conflictError(message = 'Conflict', opts = {}) {
  return makeAppError('ConflictError', message, {
    statusCode: httpStatus.CONFLICT,
    errorCode: 'CONFLICT',
    ...opts,
  });
}

export function validationError(message = 'Validation failed', details) {
  return makeAppError('ValidationError', message, {
    statusCode: httpStatus.UNPROCESSABLE_ENTITY,
    errorCode: 'VALIDATION_ERROR',
    details,
  });
}
