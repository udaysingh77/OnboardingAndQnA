// ==================================================================
// JWT authentication middleware.
// Attaches `req.user` ({ id, phone, registrationStatus }) on success.
// ==================================================================
import { unauthorizedError } from '../shared/errors.js';
import { verifyAccessToken } from '../utils/token.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorizedError('Missing or malformed Authorization header'));
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next(unauthorizedError('Missing token'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, phone: payload.phone, registrationStatus: payload.registrationStatus };
    return next();
  } catch (err) {
    return next(unauthorizedError('Invalid or expired token', { cause: err }));
  }
}
