// ==================================================================
// Health controller.
// ==================================================================
import { ok } from '../../../shared/response.js';
import { healthReport } from '../services/health.service.js';

export const getHealth = async (req, res, next) => {
  try {
    const data = await healthReport();
    const status = data.db === 'up' ? 200 : 503;
    return ok(res, { data, status });
  } catch (err) {
    return next(err);
  }
};
