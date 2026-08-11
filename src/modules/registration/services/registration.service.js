// ==================================================================
// Registration service - business logic for the onboarding status.
// Status is derived from App_Accounts.ApplicationStatus (1 = done);
// per-step persistence is deferred to the Typebot/registration
// milestone.
// ==================================================================
import { badRequestError, notFoundError } from '../../../shared/errors.js';
import { env } from '../../../config/env.js';
import { registrationRepository } from '../repositories/registration.repository.js';

const REGISTERED = 1;

async function getStatus(userId) {
  const account = await registrationRepository.findByAccountId(userId);
  if (!account) throw notFoundError('User not found');
  return toPublic(account);
}

async function updateStep(userId, { currentStep }) {
  if (currentStep < 0 || currentStep > env.REGISTRATION_TOTAL_STEPS) {
    throw badRequestError(
      `currentStep must be between 0 and ${env.REGISTRATION_TOTAL_STEPS}`,
    );
  }

  const completed = currentStep >= env.REGISTRATION_TOTAL_STEPS;
  let account = await registrationRepository.findByAccountId(userId);
  if (!account) throw notFoundError('User not found');

  if (completed && account.ApplicationStatus !== REGISTERED) {
    account = await registrationRepository.markCompleted(userId);
  }

  return toPublic(account);
}

function toPublic(account) {
  const completed = account.ApplicationStatus === REGISTERED;
  return {
    userId: String(account.AccountId),
    currentStep: completed ? env.REGISTRATION_TOTAL_STEPS : 0,
    completed,
    totalSteps: env.REGISTRATION_TOTAL_STEPS,
    updatedAt: account.ModifedDate,
  };
}

export const registrationService = {
  getStatus,
  updateStep,
};
