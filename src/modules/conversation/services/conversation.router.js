// ==================================================================
// Conversation router foundation.
// Decides which engine handles a message based on registration status:
//   completed  -> AIEngine (Q&A chat)
//   otherwise  -> RegistrationEngine (onboarding)
// Both are stubs in Week 1.
// userId is the stringified bigint App_Accounts.accountId.
// ==================================================================
import { userRepository } from '../../user/repositories/user.repository.js';
import * as aiEngine from '../engines/aiEngine.js';
import * as registrationEngine from '../engines/registrationEngine.js';

export function createConversationRouter() {
  async function route({ userId, message }) {
    const user = await userRepository.findById(userId);

    const isRegistered = user?.ApplicationStatus === 1;
    const engine = isRegistered ? aiEngine : registrationEngine;

    const result = await engine.handle({ userId, message });
    return {
      engine: isRegistered ? 'AI' : 'REGISTRATION',
      ...result,
    };
  }

  return { route };
}

export const conversationRouter = createConversationRouter();
