import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { verifyYCloudSignature } from "./ycloud-signature";

describe("verifyYCloudSignature", () => {
  const secret = "whsec_test_secret";
  const body = '{"id":"evt1","type":"contact.created"}';
  const t = String(Math.floor(Date.now() / 1000));

  it("accepts a valid YCloud-Signature", () => {
    const sig = createHmac("sha256", secret)
      .update(`${t}.${body}`)
      .digest("hex");
    const header = `t=${t},s=${sig}`;
    expect(verifyYCloudSignature(body, header, secret)).toBe(true);
  });

  it("rejects wrong signature", () => {
    const header = `t=${t},s=deadbeef`;
    expect(verifyYCloudSignature(body, header, secret)).toBe(false);
  });

  it("rejects missing header", () => {
    expect(verifyYCloudSignature(body, null, secret)).toBe(false);
  });
});
