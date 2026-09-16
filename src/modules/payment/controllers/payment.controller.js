// ==================================================================
// Payment controller - thin request dispatching and response formatting.
// ==================================================================
import { ok } from '../../../shared/response.js';
import { env } from '../../../config/env.js';
import { paymentService, PAYMENT_STATUS } from '../services/payment.service.js';

export const initiate = async (req, res, next) => {
  try {
    const data = await paymentService.initiatePayment({
      userId: req.user.id,
      productInfo: req.body?.productInfo,
    });
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const handleCallback = async (req, res, next) => {
  try {
    const data = await paymentService.handlePayuCallback(req.body);

    const isHtmlClient = req.accepts(['html', 'json']) === 'html';
    const isSuccess = data.status === PAYMENT_STATUS.SUCCESS;
    const targetUrl = isSuccess ? env.PAYU_SUCCESS_URL : env.PAYU_FAILURE_URL;

    if (isHtmlClient && targetUrl) {
      const redirectUrl = new URL(targetUrl);
      redirectUrl.searchParams.set('txnid', data.txnId);
      redirectUrl.searchParams.set('status', data.status);
      if (data.mihPayId) redirectUrl.searchParams.set('mihpayid', data.mihPayId);
      return res.redirect(302, redirectUrl.toString());
    }

    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const verifyStatus = async (req, res, next) => {
  try {
    const data = await paymentService.verifyPaymentStatus({
      userId: req.user.id,
      txnId: req.body.txnId,
    });
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const getStatus = async (req, res, next) => {
  try {
    const data = await paymentService.verifyPaymentStatus({
      userId: req.user.id,
      txnId: req.params.txnId,
    });
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const data = await paymentService.getPaymentHistory(req.user.id);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};
