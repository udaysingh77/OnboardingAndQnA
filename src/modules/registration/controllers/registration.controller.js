// ==================================================================
// Registration controller - thin.
// ==================================================================
import { ok } from '../../../shared/response.js';
import { registrationService } from '../services/registration.service.js';

export const getStatus = async (req, res, next) => {
  try {
    const data = await registrationService.getStatus(req.user.id);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const data = await registrationService.updateStep(req.user.id, req.body);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};
