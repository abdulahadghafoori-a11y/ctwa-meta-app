import { createHash } from "node:crypto";

export {
  isReasonablePhoneDigits,
  normalizePhoneDigits,
} from "./phone-digits";

/** Meta `ph` user_data field: SHA-256 of normalized phone digits, lowercase hex. */
export function hashPhoneForMeta(phoneDigits: string): string {
  const trimmed = phoneDigits.replace(/^0+/, "");
  return createHash("sha256").update(trimmed).digest("hex");
}
