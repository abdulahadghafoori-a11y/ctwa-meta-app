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
