import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies `YCloud-Signature` (HMAC-SHA256 over `{timestamp}.{rawBody}`).
 * @see https://docs.ycloud.com/reference/configure-webhooks
 */
export function verifyYCloudSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  options?: { maxSkewSeconds?: number },
): boolean {
  if (!signatureHeader?.trim() || !secret) return false;

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim();
    const value = segment.slice(eq + 1).trim();
    if (key) parts[key] = value;
  }

  const t = parts.t;
  const s = parts.s;
  if (!t || !s) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;

  const maxSkew = options?.maxSkewSeconds ?? 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > maxSkew) return false;

  const signedPayload = `${t}.${rawBody}`;
  const expectedHex = createHmac("sha256", secret).update(signedPayload).digest("hex");

  if (expectedHex.length !== s.length || !/^[0-9a-f]+$/i.test(s)) {
    return false;
  }

  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(s, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
