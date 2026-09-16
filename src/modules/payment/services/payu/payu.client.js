// ==================================================================
// PayU client - server-to-server API communication (e.g. verify_payment).
// ==================================================================
import { env } from '../../../../config/env.js';
import { logger } from '../../../../utils/logger.js';
import { generateVerifyPaymentHash } from './payu.utils.js';

export class PayuClient {
  #key;
  #salt;
  #webserviceUrl;
  #timeoutMs;

  constructor({
    key = env.PAYU_KEY,
    salt = env.PAYU_SALT,
    webserviceUrl = env.PAYU_WEBSERVICE_URL,
    timeoutMs = env.PAYU_REQUEST_TIMEOUT_MS,
  } = {}) {
    this.#key = key;
    this.#salt = salt;
    this.#webserviceUrl = webserviceUrl;
    this.#timeoutMs = timeoutMs;
  }

  /**
   * Verifies a transaction status with PayU's verify_payment webservice.
   *
   * @param {string} txnId - Unique Transaction ID
   * @returns {Promise<{ verified: boolean, transaction?: object, raw?: object }>}
   */
  async verifyPayment(txnId) {
    if (!this.#key || !this.#salt) {
      logger.warn('PayU credentials not configured, skipping live status query');
      return { verified: false, error: 'PAYU_CREDENTIALS_MISSING' };
    }

    const command = 'verify_payment';
    const hash = generateVerifyPaymentHash({
      key: this.#key,
      command,
      var1: txnId,
      salt: this.#salt,
    });

    const bodyParams = new URLSearchParams({
      key: this.#key,
      command,
      var1: txnId,
      hash,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await fetch(this.#webserviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, txnId },
          'PayU verify_payment HTTP request returned non-200',
        );
        return { verified: false, error: `HTTP_${response.status}` };
      }

      const json = await response.json();
      const details = json?.transaction_details?.[txnId];

      if (!details) {
        return {
          verified: false,
          raw: json,
          error: json?.msg || 'TRANSACTION_NOT_FOUND',
        };
      }

      return {
        verified: details.status?.toLowerCase() === 'success',
        transaction: details,
        raw: json,
      };
    } catch (err) {
      logger.error({ txnId, err: err.message }, 'Failed to verify payment with PayU webservice');
      return { verified: false, error: err.message };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const payuClient = new PayuClient();
