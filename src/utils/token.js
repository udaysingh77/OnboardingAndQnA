// ==================================================================
// JWT helpers - access token sign & verify.
// ==================================================================
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const options = { issuer: env.JWT_ISSUER, expiresIn: env.JWT_EXPIRES_IN };

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER });
}
