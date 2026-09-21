// ==================================================================
// Payment repository - data access only for App_Accounts_RegPayment, IPRS's real
// registration-payment table (see prisma/schema.prisma's AppAccountsRegPayment doc comment and
// scripts/add-regpayment-table.sql for why this table, not a table this app invented itself).
//
// No row exists for a payment until a final PayU result (success/failure) is known - "pending"
// is represented by the absence of a row, matching how this table is used elsewhere in IPRS's
// system. AccountId and PaymentRecieptId are SQL Server BigInt.
// ==================================================================
import { prisma } from '../../../shared/prisma.js';

function createResult(data) {
  return prisma.appAccountsRegPayment.create({
    data: {
      ...data,
      AccountId: BigInt(data.AccountId),
    },
  });
}

function findByTxnId(txnId) {
  return prisma.appAccountsRegPayment.findUnique({
    where: { TransactionNo: txnId },
  });
}

function updateResultByTxnId(txnId, data) {
  return prisma.appAccountsRegPayment.update({
    where: { TransactionNo: txnId },
    data: {
      ...data,
      ModifedDate: new Date(),
    },
  });
}

function findPaymentsByAccountId(accountId) {
  return prisma.appAccountsRegPayment.findMany({
    where: { AccountId: BigInt(accountId) },
    orderBy: { CreateDate: 'desc' },
  });
}

async function hasSuccessfulPayment(accountId) {
  const paid = await prisma.appAccountsRegPayment.findFirst({
    where: { AccountId: BigInt(accountId), PaymentStatus: 0 },
    select: { PaymentRecieptId: true },
  });
  return paid !== null;
}

export const paymentRepository = {
  createResult,
  findByTxnId,
  updateResultByTxnId,
  findPaymentsByAccountId,
  hasSuccessfulPayment,
};
