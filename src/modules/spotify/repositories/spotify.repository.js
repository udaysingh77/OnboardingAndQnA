import { prisma } from '../../../shared/prisma.js';

export const spotifyRepository = {
  createWorkRegistration(data) {
    return prisma.appAccountsWorkRegistration.create({ data });
  },

  countWorkRegistrationsByAccountId(accountId) {
    return prisma.appAccountsWorkRegistration.count({ where: { AccountId: BigInt(accountId) } });
  },
};
