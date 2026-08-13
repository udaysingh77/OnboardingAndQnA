// ==================================================================
// Conversation controller - thin.
// ==================================================================
import { ok } from '../../../shared/response.js';
import { badRequestError } from '../../../shared/errors.js';
import { conversationRouter } from '../services/conversation.router.js';
import * as registrationEngine from '../engines/registrationEngine.js';

export const sendMessage = async (req, res, next) => {
  try {
    const data = await conversationRouter.route({
      userId: req.user.id,
      token: req.token,
      message: req.body.message,
      attachedFileUrls: req.body.attachedFileUrls,
    });
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

// File uploads only ever happen mid-registration (the AI engine has no
// file-input concept), so this goes straight to registrationEngine
// rather than through the generic status-based router.
export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) throw badRequestError('No file uploaded');

    const data = await registrationEngine.handleUpload({
      userId: req.user.id,
      token: req.token,
      file: req.file,
    });
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};
