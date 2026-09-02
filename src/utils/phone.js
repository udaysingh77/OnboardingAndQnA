// ==================================================================
// The one place that defines what a phone number looks like once it's
// past the API boundary.
//
// AccountMobile is the login identity, so the *stored* form has to be
// canonical: a member typing "+919876543210", "919876543210" and
// "9876543210" is one person, and MSG91 treats all three as the same
// number - but a lookup by the raw string misses, and the OTP flow then
// happily creates a second account. Normalizing on the way in (lookup
// and create alike) is what makes the filtered unique index on
// App_Accounts(AccountMobile) enforceable at all.
//
// Canonical form: digits only, country code included, no leading "+"
// (e.g. "919876543210"). That matches both the rows already in the DB
// and the format msg91OtpProvider.js sends to the gateway.
// ==================================================================

// Bare national numbers are assumed Indian - the only case where the
// country code can be missing, since that's what an Indian member types.
const DEFAULT_COUNTRY_CODE = '91';
const NATIONAL_NUMBER_LENGTH = 10;
const MIN_DIGITS = 10;
const MAX_DIGITS = 15; // E.164's ceiling

// Returns the canonical form, or null when the input can't be one - callers
// decide whether that's a validation error or a value to skip.
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;

  const withCountryCode =
    digits.length === NATIONAL_NUMBER_LENGTH ? `${DEFAULT_COUNTRY_CODE}${digits}` : digits;

  if (withCountryCode.length < MIN_DIGITS || withCountryCode.length > MAX_DIGITS) return null;

  return withCountryCode;
}
