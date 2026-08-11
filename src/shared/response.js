// ==================================================================
// Shared response helpers - consistent JSON envelope for success.
//   GET/UPDATE/... -> { success: true, data, meta? }
// Errors are handled by shared/errorHandler.js, not here.
// ==================================================================
import httpStatus from 'http-status-codes';

export function ok(res, { data = null, meta = null, status = httpStatus.OK } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function created(res, data) {
  return ok(res, { data, status: httpStatus.CREATED });
}

export function accepted(res, data = null) {
  return ok(res, { data, status: httpStatus.ACCEPTED });
}
