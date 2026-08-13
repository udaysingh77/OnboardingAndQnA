// ==================================================================
// JWT authentication middleware.
// Attaches `req.user` ({ id, phone, registrationStatus }) and the raw
// bearer `req.token` (for forwarding as-is, e.g. as a Typebot
// prefilled variable) on success.
// ==================================================================
import { unauthorizedError } from '../shared/errors.js';
import { verifyAccessToken } from '../utils/token.js';
import { authService } from '../modules/auth/services/auth.service.js';

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
    if (authService.isTokenBlacklisted(token)) {
      return next(unauthorizedError('Token has been logged out'));
    }
    req.user = { id: payload.sub, phone: payload.phone, registrationStatus: payload.registrationStatus };
    req.token = token;
    return next();
  } catch (err) {
    return next(unauthorizedError('Invalid or expired token', { cause: err }));
  }
}
