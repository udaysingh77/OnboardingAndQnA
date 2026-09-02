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

function findAliasesByAccountId(accountId) {
  return prisma.appAccountsAlias.findMany({
    where: { AccountId: BigInt(accountId) },
    orderBy: { AliasId: 'asc' },
  });
}

// One at a time, ignoring the unique-index violation, rather than createMany: Prisma's
// `skipDuplicates` is not supported on SQL Server. At most a handful of names per call, so the extra
// round-trips are irrelevant, and letting the (AccountId, AliasName) index be the arbiter means a
// name arriving twice at once still can't be stored twice. Returns how many were newly inserted.
async function createAliases(accountId, names, source) {
  let count = 0;

  for (const AliasName of names) {
    try {
      await prisma.appAccountsAlias.create({
        data: { AccountId: BigInt(accountId), AliasName, Source: source },
      });
      count += 1;
    } catch (err) {
      if (err?.code !== 'P2002') throw err; // already stored for this member - not an error
    }
  }

  return { count };
}

// Emails are stored lowercase (see saveConversationField), so the caller passes an already
// normalized value. findFirst rather than findUnique: the uniqueness lives in a filtered index that
// Prisma's schema can't express, so the client doesn't know the column is unique.
function findByAccountEmail(email) {
  return prisma.appAccounts.findFirst({
    where: { AccountEmail: email },
    select: { AccountId: true },
  });
}

function markCompleted(accountId) {
  return prisma.appAccounts.update({
    where: { AccountId: BigInt(accountId) },
    data: { ApplicationStatus: 1, Detail10: 'choira' },
  });
}

function update(accountId, data) {
  return prisma.appAccounts.update({ where: { AccountId: BigInt(accountId) }, data });
}

// `DocumentName` holds the document type ("PAN"), `DocumentCaption` holds the S3 URL - see
// AGENTS.md. App_Accounts_Doc has no unique constraint on (AccountId, DocumentName), so a
// re-upload is handled as a manual find-then-update-or-create rather than a native
// Prisma upsert (which requires a unique/id field to match on).
async function upsertDocument({ accountId, caption, documentUrl, docStatus = 0 }) {
  const existing = await prisma.appAccountsDoc.findFirst({
    where: { AccountId: BigInt(accountId), DocumentName: caption },
  });

  if (existing) {
    return prisma.appAccountsDoc.update({
      where: { AccountDocId: existing.AccountDocId },
      data: { DocumentCaption: documentUrl, DocStatus: docStatus, ModifedDate: new Date() },
    });
  }

  return prisma.appAccountsDoc.create({
    data: {
      AccountId: BigInt(accountId),
      DocumentName: caption,
      DocumentCaption: documentUrl,
      DocStatus: docStatus,
    },
  });
}

function findDocumentsByAccountId(accountId) {
  return prisma.appAccountsDoc.findMany({ where: { AccountId: BigInt(accountId) } });
}

export const registrationRepository = {
  findByAccountId,
  findByAccountEmail,
  findAliasesByAccountId,
  createAliases,
  markCompleted,
  update,
  upsertDocument,
  findDocumentsByAccountId,
};
