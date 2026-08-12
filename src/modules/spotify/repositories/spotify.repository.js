import { prisma } from '../../../shared/prisma.js';

export const spotifyRepository = {
  createWorkRegistration(data) {
    return prisma.appAccountsWorkRegistration.create({ data });
  },
};
