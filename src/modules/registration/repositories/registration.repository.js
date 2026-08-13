// ==================================================================
// Registration repository - data access only.
// Registration state is read from App_Accounts.ApplicationStatus
// (1 = fully registered). Section-based Typebot persistence writes
// App_Accounts fields directly and App_Accounts_Doc rows for documents.
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

function update(accountId, data) {
  return prisma.appAccounts.update({ where: { AccountId: BigInt(accountId) }, data });
}

// App_Accounts_Doc has no unique constraint on (AccountId, DocumentCaption), so a
// re-upload is handled as a manual find-then-update-or-create rather than a native
// Prisma upsert (which requires a unique/id field to match on).
async function upsertDocument({ accountId, caption, documentUrl, docStatus = 0 }) {
  const existing = await prisma.appAccountsDoc.findFirst({
    where: { AccountId: BigInt(accountId), DocumentCaption: caption },
  });

  if (existing) {
    return prisma.appAccountsDoc.update({
      where: { AccountDocId: existing.AccountDocId },
      data: { DocumentName: documentUrl, DocStatus: docStatus, ModifedDate: new Date() },
    });
  }

  return prisma.appAccountsDoc.create({
    data: {
      AccountId: BigInt(accountId),
      DocumentCaption: caption,
      DocumentName: documentUrl,
      DocStatus: docStatus,
    },
  });
}

function findDocumentsByAccountId(accountId) {
  return prisma.appAccountsDoc.findMany({ where: { AccountId: BigInt(accountId) } });
}

export const registrationRepository = {
  findByAccountId,
  markCompleted,
  update,
  upsertDocument,
  findDocumentsByAccountId,
};
