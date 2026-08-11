// ==================================================================
// Registration repository - data access only.
// Registration state is read from App_Accounts.ApplicationStatus
// (1 = fully registered). Per-step persistence is deferred to the
// Typebot/registration milestone.
// ==================================================================
import { prisma } from '../../../shared/prisma.js';

function findByAccountId(accountId) {
  return prisma.appAccounts.findUnique({ where: { AccountId: BigInt(accountId) } });
}

function markCompleted(accountId) {
  return prisma.appAccounts.update({
    where: { AccountId: BigInt(accountId) },
    data: { ApplicationStatus: 1 },
  });
}

export const registrationRepository = {
  findByAccountId,
  markCompleted,
};
