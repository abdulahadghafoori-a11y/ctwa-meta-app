/** Strip to digits only (Meta CAPI: remove symbols and letters before hashing). */
export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/** Loose E.164-ish validation: at least 8 digits. */
export function isReasonablePhoneDigits(digits: string): boolean {
  return digits.length >= 8 && digits.length <= 15;
}
