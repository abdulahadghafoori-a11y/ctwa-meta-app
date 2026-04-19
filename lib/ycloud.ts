/**
 * Normalize YCloud WhatsApp inbound webhooks (v2 envelope + whatsappInboundMessage).
 * @see https://docs.ycloud.com — whatsapp.inbound_message.received
 */

import { parseToE164 } from "@/lib/phone-e164";

export const YCLOUD_WHATSAPP_INBOUND_TYPE = "whatsapp.inbound_message.received";

export const YCLOUD_CONTACT_CREATED_TYPE = "contact.created";

/** Parsed inbound webhook fields (contact upsert + session insert; session stores only FK + attribution + send_time). */
export type WebhookSessionFields = {
  /** E.164 with +; persisted on `contacts.phone_number` only. */
  phoneNumber: string;
  /** Display name for `contacts.name` (same semantics as contact.created `nickName`). */
  name: string | null;
  customerProfile: Record<string, unknown>;
  ctwaClid: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  envelopeCreateTime: Date | null;
  sendTime: Date;
};

/** Parsed `contact.created` payload (YCloud v2). */
export type ContactCreatedFields = {
  phoneNumber: string;
  name: string | null;
  countryCode: string | null;
  countryName: string | null;
  createTime: Date;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * YCloud v2 nests the message under `whatsappInboundMessage`.
 * Older / flatter payloads use the root as the message object.
 */
export function getInboundMessageObject(body: unknown): unknown {
  const rec = asRecord(body);
  const wim = rec?.whatsappInboundMessage;
  if (wim !== null && typeof wim === "object" && !Array.isArray(wim)) {
    return wim;
  }
  return body;
}

function findDeepStringProp(root: unknown, prop: string): string | null {
  const seen = new Set<unknown>();

  function walk(node: unknown): string | null {
    if (node === null || node === undefined) return null;
    if (typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }

    const o = node as Record<string, unknown>;
    if (typeof o[prop] === "string" && (o[prop] as string).length > 0) {
      return o[prop] as string;
    }
    for (const v of Object.values(o)) {
      const found = walk(v);
      if (found) return found;
    }
    return null;
  }

  return walk(root);
}

export function findCtwaClid(obj: unknown): string | null {
  const fromReferral = asRecord(asRecord(obj)?.referral)?.ctwa_clid;
  if (typeof fromReferral === "string" && fromReferral.length > 0) {
    return fromReferral;
  }
  return findDeepStringProp(obj, "ctwa_clid");
}

/** Prefer `whatsappInboundMessage.from` for v2 to avoid picking `context.from`. */
function findPhoneFromMessage(message: unknown, fallback: unknown): string | null {
  const msg = asRecord(message);
  if (typeof msg?.from === "string") {
    const s = msg.from.replace(/\s/g, "");
    if (/\d/.test(s)) return s;
  }
  return findPhoneLegacy(message) ?? findPhoneLegacy(fallback);
}

function findPhoneLegacy(obj: unknown): string | null {
  const rec = asRecord(obj);
  const candidates: string[] = [];
  if (typeof rec?.from === "string") candidates.push(rec.from);
  if (typeof rec?.wa_id === "string") candidates.push(rec.wa_id);
  if (typeof rec?.phone === "string") candidates.push(rec.phone);
  if (typeof rec?.phone_number === "string") candidates.push(rec.phone_number);
  for (const c of candidates) {
    if (/\d/.test(c)) return c.replace(/\s/g, "");
  }
  const deep = findDeepStringProp(obj, "from");
  if (deep && /\d/.test(deep)) return deep.replace(/\s/g, "");
  return null;
}

/** YCloud `customerProfile` on inbound message */
export function findCustomerNameFromInbound(message: unknown, body: unknown): string | null {
  const msg = asRecord(message);
  const cp = asRecord(msg?.customerProfile);
  if (cp && typeof cp.name === "string" && cp.name.trim()) {
    return cp.name.trim();
  }
  if (typeof cp?.username === "string" && cp.username.trim()) {
    return cp.username.trim().replace(/^@/, "");
  }

  const rec = asRecord(message);
  const profile = asRecord(rec?.profile);
  const contact = asRecord(rec?.contact);
  const name =
    (typeof rec?.profile_name === "string" && rec.profile_name) ||
    (profile && typeof profile.name === "string" && profile.name) ||
    (contact && typeof contact.name === "string" && contact.name) ||
    (typeof rec?.name === "string" && rec.name);
  if (name) return name;

  return findDeepCustomerNameFallback(body);
}

function findDeepCustomerNameFallback(body: unknown): string | null {
  const rec = asRecord(body);
  const profile = asRecord(rec?.profile);
  const contact = asRecord(rec?.contact);
  if (typeof rec?.profile_name === "string" && rec.profile_name) return rec.profile_name;
  if (profile && typeof profile.name === "string") return profile.name;
  if (contact && typeof contact.name === "string") return contact.name;
  return typeof rec?.name === "string" ? rec.name : null;
}

function parseIsoToUnixSeconds(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = Date.parse(v);
  if (Number.isNaN(d)) return null;
  return Math.floor(d / 1000);
}

function parseIsoToDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function findTimestampSeconds(message: unknown, body: unknown): number | null {
  const msg = asRecord(message);
  const env = asRecord(body);
  const fromIso =
    parseIsoToUnixSeconds(msg?.sendTime) ??
    parseIsoToUnixSeconds(env?.createTime);
  if (fromIso !== null) return fromIso;

  const rec = asRecord(message) ?? asRecord(body);
  const raw =
    rec?.timestamp ?? rec?.message_timestamp ?? rec?.time ?? rec?.date;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const iso = parseIsoToUnixSeconds(raw);
    if (iso !== null) return iso;
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
    }
  }
  return null;
}

function customerProfileObject(message: unknown): Record<string, unknown> {
  const msg = asRecord(message);
  const cp = msg?.customerProfile;
  if (cp !== null && typeof cp === "object" && !Array.isArray(cp)) {
    return { ...(cp as Record<string, unknown>) };
  }
  return {};
}

function referralSourceFields(message: unknown): {
  sourceId: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
} {
  const ref = asRecord(asRecord(message)?.referral);
  if (!ref) {
    return { sourceId: null, sourceUrl: null, sourceType: null };
  }
  return {
    sourceId: typeof ref.source_id === "string" ? ref.source_id : null,
    sourceUrl: typeof ref.source_url === "string" ? ref.source_url : null,
    sourceType: typeof ref.source_type === "string" ? ref.source_type : null,
  };
}

export function isSupportedYCloudInboundType(body: unknown): boolean {
  const t = asRecord(body)?.type;
  if (t === undefined || t === null) return true;
  if (typeof t !== "string") return true;
  if (t === YCLOUD_CONTACT_CREATED_TYPE) return false;
  return t === YCLOUD_WHATSAPP_INBOUND_TYPE;
}

/** Earliest of send time and envelope time for `contacts.create_time` merge (inbound). */
export function inboundContactCreateTimeCandidate(
  sendTime: Date,
  envelopeCreateTime: Date | null,
): Date {
  if (!envelopeCreateTime) return sendTime;
  return new Date(
    Math.min(sendTime.getTime(), envelopeCreateTime.getTime()),
  );
}

/**
 * Extracts fields from `contact.created`. Returns null if phone or createTime is missing.
 */
export function extractContactCreatedFields(
  body: unknown,
): ContactCreatedFields | null {
  const cc = asRecord(asRecord(body)?.contactCreated);
  if (!cc) return null;

  const phoneRaw =
    typeof cc.phoneNumber === "string" ? cc.phoneNumber.replace(/\s/g, "") : "";

  const countryCode =
    typeof cc.countryCode === "string" && cc.countryCode.trim()
      ? cc.countryCode.trim()
      : null;

  const e164 = parseToE164(phoneRaw, countryCode);
  if (!e164) return null;

  const name =
    typeof cc.nickName === "string" && cc.nickName.trim()
      ? cc.nickName.trim()
      : null;

  const countryName =
    typeof cc.countryName === "string" && cc.countryName.trim()
      ? cc.countryName.trim()
      : null;

  const createTime = parseIsoToDate(cc.createTime);
  if (!createTime) return null;

  return {
    phoneNumber: e164,
    name,
    countryCode,
    countryName,
    createTime,
  };
}

/**
 * Extracts session fields from webhook body. Returns null only if phone cannot be resolved.
 * `ctwaClid` may be null (caller ignores non-CTWA traffic).
 */
export function extractWebhookSessionFields(
  body: unknown,
): WebhookSessionFields | null {
  const message = getInboundMessageObject(body);
  const phoneRaw =
    findPhoneFromMessage(message, body) ?? findPhoneLegacy(message);
  if (!phoneRaw) return null;

  const e164 = parseToE164(phoneRaw);
  if (!e164) return null;

  const ctwaClid = findCtwaClid(message) ?? findCtwaClid(body);
  const { sourceId, sourceUrl, sourceType } = referralSourceFields(message);
  const env = asRecord(body);

  const envelopeCreateSec = parseIsoToUnixSeconds(env?.createTime);
  const envelopeCreateTime = envelopeCreateSec
    ? new Date(envelopeCreateSec * 1000)
    : null;
  const ts =
    findTimestampSeconds(message, body) ?? Math.floor(Date.now() / 1000);
  const sendTime = new Date(ts * 1000);

  return {
    phoneNumber: e164,
    name: findCustomerNameFromInbound(message, body),
    customerProfile: customerProfileObject(message),
    ctwaClid: ctwaClid?.trim() ? ctwaClid.trim() : null,
    sourceId,
    sourceUrl,
    sourceType,
    envelopeCreateTime,
    sendTime,
  };
}
