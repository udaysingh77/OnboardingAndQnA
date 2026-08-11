// ==================================================================
// Central error handler (4-arg) + 404 handler. Mounted LAST in app.js.
//   - AppError subclasses (operational) -> show message/details.
//   - Zod / Prisma / JSON parse errors -> normalized to AppError.
//   - Anything else -> sanitized 500 (no stack leakage), full log.
// ==================================================================
import httpStatus from 'http-status-codes';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { appError, validationError, notFoundError, conflictError } from './errors.js';
import { logger } from '../utils/logger.js';

function normalizeError(err) {
  if (err instanceof ZodError) {
    return validationError('Validation failed', err.flatten().fieldErrors);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return conflictError(
          `Duplicate value for unique constraint on: ${err.meta?.target ?? 'unknown'}`,
        );
      case 'P2025':
        return notFoundError('Record not found');
      case 'P2003':
      case 'P2014':
        return appError('Database integrity constraint error', {
          statusCode: httpStatus.BAD_REQUEST,
          errorCode: 'BAD_REQUEST',
        });
      default:
        return appError(`Database error (${err.code})`);
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return appError('Invalid database query', {
      statusCode: httpStatus.BAD_REQUEST,
      errorCode: 'BAD_REQUEST',
    });
  }

  // JSON body parse failures thrown by express.json()
  if (err && err.type === 'entity.parse.failed') {
    return appError('Malformed JSON body', {
      statusCode: httpStatus.BAD_REQUEST,
      errorCode: 'BAD_REQUEST',
    });
  }

  return err;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  const statusCode = normalized.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  const isOperational = normalized?.isOperational === true;
  const requestId = req.id;

  if (isOperational) {
    const body = {
      success: false,
      error: {
        code: normalized.errorCode || 'ERROR',
        message: normalized.message || httpStatus.getStatusText(statusCode),
      },
    };
    if (normalized.details) body.error.details = normalized.details;

    logger.warn({ requestId, statusCode }, `Operational error: ${normalized.message}`);
    return res.status(statusCode).json(body);
  }

  // Unknown / programming error â€” never leak internals to the client
  logger.error({ requestId, err: normalized }, 'Unhandled error');
  return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}

export function notFoundHandler(req, res, next) {
  next(notFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}
