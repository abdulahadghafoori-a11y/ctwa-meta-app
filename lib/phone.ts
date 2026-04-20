import { createHash } from "node:crypto";

import { e164ToDigits } from "./phone-e164";

export {
  isReasonablePhoneDigits,
  normalizePhoneDigits,
} from "./phone-digits";

export { e164ToDigits, isValidE164Input, parseToE164 } from "./phone-e164";

/** Meta `ph` user_data field: SHA-256 of normalized phone digits, lowercase hex. */
export function hashPhoneForMeta(phoneDigitsOrE164: string): string {
  const digits = phoneDigitsOrE164.startsWith("+")
    ? e164ToDigits(phoneDigitsOrE164)
    : phoneDigitsOrE164.replace(/\D/g, "");
  const trimmed = digits.replace(/^0+/, "");
  return createHash("sha256").update(trimmed).digest("hex");
}

/** Meta `external_id`: SHA-256 of trimmed, lowercased stable id (e.g. contact UUID). */
export function hashExternalIdForMeta(externalId: string): string {
  const normalized = externalId.trim().toLowerCase();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** Meta `country`: SHA-256 of ISO 3166-1 alpha-2 lowercase (e.g. `us`). */
export function hashCountryForMeta(iso3166Alpha2: string): string | null {
  const c = iso3166Alpha2.trim().toLowerCase();
  if (c.length !== 2) return null;
  return createHash("sha256").update(c, "utf8").digest("hex");
}
