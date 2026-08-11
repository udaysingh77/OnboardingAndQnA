// ==================================================================
// Auth controller - thin: parses validated input, calls service,
// formats response. No business logic.
// ==================================================================
import { ok, accepted } from '../../../shared/response.js';
import { authService } from '../services/auth.service.js';

export const sendOtp = async (req, res, next) => {
  try {
    const result = await authService.sendOtp(req.body);
    return ok(res, { data: result });
  } catch (err) {
    return next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyOtp(req.body);
    return ok(res, { data: result });
  } catch (err) {
    return next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.slice('Bearer '.length).trim();
    const result = authService.logout(token);
    return ok(res, { data: result });
  } catch (err) {
    return next(err);
  }
};
