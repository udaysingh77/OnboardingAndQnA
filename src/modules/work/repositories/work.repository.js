// ==================================================================
// App_Accounts_WorkRegistration repository - the songs a member claims
// as their own. Data access only.
//
// Moved here from modules/spotify: the table holds work links from any
// provider (Spotify or YouTube), so it no longer belongs to the Spotify
// module. modules/spotify keeps its API client and claim service.
// ==================================================================
import { prisma } from '../../../shared/prisma.js';

function createWorkRegistration(data) {
  return prisma.appAccountsWorkRegistration.create({ data });
}

function countByAccountId(accountId) {
  return prisma.appAccountsWorkRegistration.count({
    where: { AccountId: BigInt(accountId) },
  });
}

// Oldest first, so the pre-payment review lists the member's songs in the order they added them.
function findByAccountId(accountId) {
  return prisma.appAccountsWorkRegistration.findMany({
    where: { AccountId: BigInt(accountId) },
    orderBy: { WorkNotificationId: 'asc' },
  });
}

export const workRepository = { createWorkRegistration, countByAccountId, findByAccountId };
