// ==================================================================
// PayU cryptographic utilities - SHA-512 request and reverse hash helpers.
// ==================================================================
import crypto from 'node:crypto';

/**
 * Formats amount to 2 decimal places as required by PayU.
 * @param {number|string} amount
 * @returns {string}
 */
export function formatAmount(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? 0));
  if (Number.isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * Generates PayU outgoing payment request SHA-512 hash.
 * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt)
 *
 * @param {object} params
 * @param {string} params.key - Merchant Key
 * @param {string} params.txnid - Unique Transaction ID
 * @param {number|string} params.amount - Amount
 * @param {string} params.productinfo - Product Info / Description
 * @param {string} params.firstname - Customer First Name
 * @param {string} params.email - Customer Email
 * @param {string} [params.udf1='']
 * @param {string} [params.udf2='']
 * @param {string} [params.udf3='']
 * @param {string} [params.udf4='']
 * @param {string} [params.udf5='']
 * @param {string} [params.udf6='']
 * @param {string} [params.udf7='']
 * @param {string} [params.udf8='']
 * @param {string} [params.udf9='']
 * @param {string} [params.udf10='']
 * @param {string} params.salt - Merchant Salt
 * @returns {string} SHA-512 lowercase hash
 */
export function generatePayuHash({
  key,
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  udf1 = '',
  udf2 = '',
  udf3 = '',
  udf4 = '',
  udf5 = '',
  udf6 = '',
  udf7 = '',
  udf8 = '',
  udf9 = '',
  udf10 = '',
  salt,
}) {
  const formattedAmount = formatAmount(amount);
  const hashString = [
    key ?? '',
    txnid ?? '',
    formattedAmount,
    productinfo ?? '',
    firstname ?? '',
    email ?? '',
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    udf6,
    udf7,
    udf8,
    udf9,
    udf10,
    salt ?? '',
  ].join('|');

  return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
}

/**
 * Verifies the PayU response reverse hash.
 * Formula:
 * If additionalCharges:
 *   sha512(additionalCharges|salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * Else:
 *   sha512(salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * @param {object} params - PayU POST callback payload
 * @param {string} salt - Merchant Salt
 * @returns {boolean} True if calculated hash matches the received hash
 */
export function verifyPayuHash(params, salt) {
  if (!params || !salt) return false;

  const receivedHash = String(params.hash ?? params.posted_hash ?? '').trim().toLowerCase();
  if (!receivedHash) return false;

  const {
    additionalCharges,
    status = '',
    udf10 = '',
    udf9 = '',
    udf8 = '',
    udf7 = '',
    udf6 = '',
    udf5 = '',
    udf4 = '',
    udf3 = '',
    udf2 = '',
    udf1 = '',
    email = '',
    firstname = '',
    productinfo = '',
    amount = '',
    txnid = '',
    key = '',
  } = params;

  const formattedAmount = formatAmount(amount);

  const elements = [
    status,
    udf10,
    udf9,
    udf8,
    udf7,
    udf6,
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    email,
    firstname,
    productinfo,
    formattedAmount,
    txnid,
    key,
  ];

  let hashSequence;
  if (additionalCharges && String(additionalCharges).trim() !== '') {
    const formattedCharges = formatAmount(additionalCharges);
    hashSequence = [formattedCharges, salt, ...elements].join('|');
  } else {
    hashSequence = [salt, ...elements].join('|');
  }

  const calculatedHash = crypto.createHash('sha512').update(hashSequence).digest('hex').toLowerCase();

  // Timing safe comparison when strings have equal length
  try {
    const bufA = Buffer.from(calculatedHash, 'utf8');
    const bufB = Buffer.from(receivedHash, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return calculatedHash === receivedHash;
  }
}

/**
 * Generates SHA-512 hash for PayU verify_payment webservice command.
 * Formula: sha512(key|command|var1|salt)
 *
 * @param {object} params
 * @param {string} params.key
 * @param {string} [params.command='verify_payment']
 * @param {string} params.var1 - Transaction ID(s)
 * @param {string} params.salt
 * @returns {string} SHA-512 lowercase hash
 */
export function generateVerifyPaymentHash({ key, command = 'verify_payment', var1, salt }) {
  const hashString = [key ?? '', command, var1 ?? '', salt ?? ''].join('|');
  return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
}
