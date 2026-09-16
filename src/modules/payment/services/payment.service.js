// ==================================================================
// Payment service - PayU checkout orchestration, hash computation,
// callback processing, and status reconciliation.
// ==================================================================
import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { badRequestError, conflictError, forbiddenError, notFoundError } from '../../../shared/errors.js';
import { userRepository } from '../../user/repositories/user.repository.js';
import { registrationService } from '../../registration/services/registration.service.js';
import { conversationJournalService } from '../../conversation/services/conversationJournal.service.js';
import { typebotSessionStore } from '../../conversation/services/typebot/typebotSessionStore.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { formatAmount, generatePayuHash, verifyPayuHash } from './payu/payu.utils.js';
import { payuClient } from './payu/payu.client.js';
import { resolveFee } from './payu/feeSchedule.js';

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

function generateTxnId(userId) {
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `IPRS_${userId}_${Date.now()}_${randomSuffix}`;
}

function toPublic(payment) {
  if (!payment) return null;
  return {
    paymentId: String(payment.PaymentId),
    userId: String(payment.AccountId),
    txnId: payment.TxnId,
    mihPayId: payment.MihPayId ?? null,
    amount: payment.Amount,
    currency: payment.Currency,
    status: payment.Status,
    paymentMode: payment.PaymentMode ?? null,
    bankRefNo: payment.BankRefNo ?? null,
    productInfo: payment.ProductInfo ?? null,
    customerName: payment.CustomerName ?? null,
    customerEmail: payment.CustomerEmail ?? null,
    customerPhone: payment.CustomerPhone ?? null,
    errorMessage: payment.ErrorMessage ?? null,
    createdAt: payment.CreateDate,
    updatedAt: payment.ModifedDate,
  };
}

/**
 * Initiates a new PayU payment transaction for the member. The amount is never taken from the
 * caller - it's resolved server-side from the member's own role answer (RollTypeIds), already
 * saved during the Typebot conversation, via feeSchedule.js. This is what stops a member paying
 * whatever they like instead of their actual membership fee.
 */
async function initiatePayment({ userId, productInfo }) {
  const account = await userRepository.findById(userId);
  if (!account) {
    throw notFoundError('User not found');
  }

  const numAmount = resolveFee(account.RollTypeIds);
  if (numAmount == null) {
    // Either the member hasn't reached the role-choice question yet, or the flow's role-choice
    // wording changed and feeSchedule.js's keys are stale - either way, guessing a fee here would
    // be worse than refusing to start a payment for it.
    throw badRequestError('Registration incomplete: role not yet determined, cannot compute fee', {
      errorCode: 'REGISTRATION_INCOMPLETE',
      details: { rollTypeIds: account.RollTypeIds ?? null },
    });
  }

  // The payment button is a terminal state in our flow, but nothing stops a stale chat tab (or a
  // back button) from firing this a second time - and every call mints a fresh PayU checkout the
  // member could actually go through with. Only a SUCCESS blocks: a PENDING row is what an
  // abandoned PayU page leaves behind, and locking those members out of retrying would be worse.
  if (await paymentRepository.hasSuccessfulPayment(userId)) {
    throw conflictError('This registration has already been paid for', {
      errorCode: 'PAYMENT_ALREADY_COMPLETED',
    });
  }

  const txnId = generateTxnId(userId);
  const formattedAmount = formatAmount(numAmount);
  const info = String(productInfo || 'IPRS Membership Onboarding Fee').trim();
  const customerName = (account.AccountName || account.FirstName || 'Member').trim();
  const customerEmail = (account.AccountEmail || '').trim();
  const customerPhone = (account.AccountMobile || '').trim();
  const udf1 = String(userId);

  const hash = generatePayuHash({
    key: env.PAYU_KEY,
    txnid: txnId,
    amount: formattedAmount,
    productinfo: info,
    firstname: customerName,
    email: customerEmail,
    udf1,
    salt: env.PAYU_SALT,
  });

  const paymentRecord = await paymentRepository.createPayment({
    AccountId: userId,
    TxnId: txnId,
    Amount: numAmount,
    Currency: 'INR',
    Status: PAYMENT_STATUS.PENDING,
    ProductInfo: info,
    CustomerName: customerName,
    CustomerEmail: customerEmail,
    CustomerPhone: customerPhone,
  });

  logger.info({ userId, txnId, amount: numAmount }, 'Initiated PayU payment transaction');

  const actionUrl = `${env.PAYU_BASE_URL.replace(/\/+$/, '')}/_payment`;

  return {
    payment: toPublic(paymentRecord),
    key: env.PAYU_KEY,
    txnId,
    amount: formattedAmount,
    currency: 'INR',
    hash,
    actionUrl,
    params: {
      key: env.PAYU_KEY,
      txnid: txnId,
      amount: formattedAmount,
      productinfo: info,
      firstname: customerName,
      email: customerEmail,
      phone: customerPhone,
      // PayU must POST its result to OUR backend, not straight to a frontend page - PAYU_CALLBACK_URL
      // is that endpoint (this service's own POST /payment/callback). Falls back to
      // PAYU_SUCCESS_URL/FAILURE_URL only when it's unset, matching this code's old behaviour.
      surl: env.PAYU_CALLBACK_URL || env.PAYU_SUCCESS_URL || '',
      furl: env.PAYU_CALLBACK_URL || env.PAYU_FAILURE_URL || '',
      hash,
      udf1,
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: '',
    },
  };
}

/**
 * Handles PayU callback / webhook / redirect response.
 */
async function handlePayuCallback(payuPayload) {
  if (!payuPayload || typeof payuPayload !== 'object') {
    throw badRequestError('Invalid payment callback payload');
  }

  const txnId = payuPayload.txnid;
  if (!txnId) {
    throw badRequestError('Missing transaction ID (txnid) in callback payload');
  }

  const isValidSignature = verifyPayuHash(payuPayload, env.PAYU_SALT);

  if (!isValidSignature) {
    logger.warn({ txnId, payload: payuPayload }, 'PayU callback signature verification failed');
    try {
      const existing = await paymentRepository.findByTxnId(txnId);
      if (existing) {
        await paymentRepository.updatePaymentByTxnId(txnId, {
          Status: PAYMENT_STATUS.FAILED,
          ErrorMessage: 'Signature / Hash verification failed',
          PayuResponse: JSON.stringify(payuPayload),
        });
      }
    } catch {
      // Non-fatal if DB is unreachable or table not yet migrated during signature validation
    }
    throw badRequestError('Invalid payment signature');
  }

  const existing = await paymentRepository.findByTxnId(txnId);


  if (!existing) {
    logger.warn({ txnId }, 'PayU callback received for unknown transaction ID');
    throw notFoundError('Payment transaction not found');
  }

  const rawStatus = String(payuPayload.status || '').trim().toLowerCase();
  const isSuccess = rawStatus === 'success';
  const newStatus = isSuccess ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.FAILED;

  const updated = await paymentRepository.updatePaymentByTxnId(txnId, {
    Status: newStatus,
    MihPayId: payuPayload.mihpayid ? String(payuPayload.mihpayid) : null,
    PaymentMode: payuPayload.mode ? String(payuPayload.mode) : null,
    BankRefNo: payuPayload.bank_ref_num ? String(payuPayload.bank_ref_num) : null,
    PayuResponse: JSON.stringify(payuPayload),
    ErrorMessage: isSuccess ? null : (payuPayload.error_Message || payuPayload.unmappedstatus || 'Payment failed'),
  });

  logger.info(
    { userId: String(existing.AccountId), txnId, status: newStatus, mihpayid: payuPayload.mihpayid },
    'Processed PayU payment callback',
  );

  // If successful, attempt to mark the registration complete
  if (isSuccess) {
    const userIdStr = String(existing.AccountId);
    try {
      await registrationService.complete(userIdStr, userIdStr);
      logger.info({ userId: userIdStr, txnId }, 'Registration completed on payment confirmation');

      // The member's Typebot session is still parked on the payment button - it is never driven
      // past it (see paymentGate.js), so without this it would dangle until the process restarts.
      // Clearing both is only safe once complete() has actually succeeded: if it threw, the member
      // still needs the journal to resume and finish whatever is missing.
      typebotSessionStore.clear(userIdStr);
      await conversationJournalService.clearJournal(userIdStr);
    } catch (err) {
      // Money has changed hands and the member is still not registered - that is not info-level.
      logger.warn(
        { userId: userIdStr, txnId, err: err.message },
        'Payment succeeded but the registration could not be completed (documents or info still pending)',
      );
    }
  }

  return toPublic(updated);
}

/**
 * Checks or verifies the payment status of a transaction for the authenticated member.
 */
async function verifyPaymentStatus({ userId, txnId }) {
  const existing = await paymentRepository.findByTxnId(txnId);
  if (!existing) {
    throw notFoundError('Transaction not found');
  }

  if (String(existing.AccountId) !== String(userId)) {
    throw forbiddenError('Transaction does not belong to the authenticated user');
  }

  // If still pending, query PayU's verify_payment webservice directly
  if (existing.Status === PAYMENT_STATUS.PENDING) {
    const check = await payuClient.verifyPayment(txnId);
    if (check.verified && check.transaction) {
      const details = check.transaction;
      const isSuccess = details.status?.toLowerCase() === 'success';
      const newStatus = isSuccess ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.FAILED;

      const updated = await paymentRepository.updatePaymentByTxnId(txnId, {
        Status: newStatus,
        MihPayId: details.mihpayid ? String(details.mihpayid) : null,
        PaymentMode: details.mode ? String(details.mode) : null,
        BankRefNo: details.bank_ref_num ? String(details.bank_ref_num) : null,
        PayuResponse: JSON.stringify(check.raw ?? {}),
        ErrorMessage: isSuccess ? null : (details.error_Message || details.unmappedstatus || 'Payment failed'),
      });

      if (isSuccess) {
        try {
          const userIdStr = String(existing.AccountId);
          await registrationService.complete(userIdStr, userIdStr);
        } catch {
          // ignore incomplete requirements
        }
      }

      return toPublic(updated);
    }
  }

  return toPublic(existing);
}

/**
 * Gets all payment transactions for the member.
 */
async function getPaymentHistory(userId) {
  const payments = await paymentRepository.findPaymentsByAccountId(userId);
  return payments.map(toPublic);
}

/**
 * Has this member's registration fee actually been paid? Exposed on the service (rather than
 * letting callers reach for the repository) so the conversation engine can ask without crossing
 * into another module's data-access layer.
 */
function hasSuccessfulPayment(userId) {
  return paymentRepository.hasSuccessfulPayment(userId);
}

export const paymentService = {
  initiatePayment,
  handlePayuCallback,
  verifyPaymentStatus,
  getPaymentHistory,
  hasSuccessfulPayment,
  PAYMENT_STATUS,
  toPublic,
};
