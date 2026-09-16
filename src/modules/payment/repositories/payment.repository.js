// ==================================================================
// Payment repository - data access only for App_Accounts_Payment.
// AccountId and PaymentId are SQL Server BigInt.
// ==================================================================
import { prisma } from '../../../shared/prisma.js';

function createPayment(data) {
  return prisma.appAccountsPayment.create({
    data: {
      ...data,
      AccountId: BigInt(data.AccountId),
    },
  });
}

function findByTxnId(txnId) {
  return prisma.appAccountsPayment.findUnique({
    where: { TxnId: txnId },
  });
}

function updatePaymentByTxnId(txnId, data) {
  return prisma.appAccountsPayment.update({
    where: { TxnId: txnId },
    data: {
      ...data,
      ModifedDate: new Date(),
    },
  });
}

function findPaymentsByAccountId(accountId) {
  return prisma.appAccountsPayment.findMany({
    where: { AccountId: BigInt(accountId) },
    orderBy: { CreateDate: 'desc' },
  });
}

async function hasSuccessfulPayment(accountId) {
  const paid = await prisma.appAccountsPayment.findFirst({
    where: { AccountId: BigInt(accountId), Status: 'SUCCESS' },
    select: { PaymentId: true },
  });
  return paid !== null;
}

export const paymentRepository = {
  createPayment,
  findByTxnId,
  updatePaymentByTxnId,
  findPaymentsByAccountId,
  hasSuccessfulPayment,
};
