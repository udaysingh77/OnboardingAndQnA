// ==================================================================
// Conversation controller - thin.
// ==================================================================
import { ok } from '../../../shared/response.js';
import { conversationRouter } from '../services/conversation.router.js';

export const sendMessage = async (req, res, next) => {
  try {
    const data = await conversationRouter.route({
      userId: req.user.id,
      message: req.body.message,
    });
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};
