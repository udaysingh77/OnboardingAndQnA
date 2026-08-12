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

export const start = async (req, res, next) => {
  try {
    const data = await registrationService.start(req.user.id);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const saveBasicDetails = async (req, res, next) => {
  try {
    const data = await registrationService.saveBasicDetails(req.user.id, req.params.registrationId, req.body);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const uploadDocument = async (req, res, next) => {
  try {
    const data = await registrationService.saveDocument(
      req.user.id,
      req.params.registrationId,
      req.params.documentType,
      req.body.documentUrl,
    );
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const complete = async (req, res, next) => {
  try {
    const data = await registrationService.complete(req.user.id, req.params.registrationId);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};
