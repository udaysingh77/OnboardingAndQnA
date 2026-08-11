// ==================================================================
// User controller - thin: passes validated input to service.
// ==================================================================
import { created, ok } from '../../../shared/response.js';
import { userService } from '../services/user.service.js';

export const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    return created(res, user);
  } catch (err) {
    return next(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return ok(res, { data: user });
  } catch (err) {
    return next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    return ok(res, { data: user });
  } catch (err) {
    return next(err);
  }
};

export const checkUserExists = async (req, res, next) => {
  try {
    const result = await userService.userExists(req.query.phone);
    return ok(res, { data: result });
  } catch (err) {
    return next(err);
  }
};
