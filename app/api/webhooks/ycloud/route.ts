/**
 * YCloud webhooks: `contact.created` merges into contacts; inbound CTWA upserts contact + ctwa_sessions.
 *
 * Configure in YCloud Console → Developers → Webhooks: POST `https://<your-host>/api/webhooks/ycloud`
 * Events: `whatsapp.inbound_message.received`, `contact.created` (others return 200 ignored).
 */

import { NextResponse } from "next/server";

import { ctwaSessions } from "@/drizzle/schema";
import { upsertContactByPhone } from "@/lib/contacts";
import { db } from "@/lib/db";
import { verifyYCloudSignature } from "@/lib/ycloud-signature";
import {
  extractContactCreatedFields,
  extractWebhookSessionFields,
  inboundContactCreateTimeCandidate,
  isSupportedYCloudInboundType,
  YCLOUD_CONTACT_CREATED_TYPE,
} from "@/lib/ycloud";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const secret = process.env.YCLOUD_WEBHOOK_SECRET?.trim();
  if (secret) {
    const sig = request.headers.get("YCloud-Signature") ?? request.headers.get("ycloud-signature");
    if (!verifyYCloudSignature(rawBody, sig, secret)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  const eventType =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).type
      : undefined;
  if (eventType === YCLOUD_CONTACT_CREATED_TYPE) {
    const fields = extractContactCreatedFields(body);
    if (!fields) {
      return NextResponse.json(
        { ok: false, error: "Could not extract contact from payload" },
        { status: 422 },
      );
    }
    try {
      await upsertContactByPhone({
        phoneNumber: fields.phoneNumber,
        name: fields.name,
        countryCode: fields.countryCode,
        countryName: fields.countryName,
        createTime: fields.createTime,
      });
    } catch (e) {
      console.error("[ycloud webhook] contact.created upsert failed", e);
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!isSupportedYCloudInboundType(body)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const fields = extractWebhookSessionFields(body);
  if (!fields) {
    return NextResponse.json(
      { ok: false, error: "Could not extract phone from payload" },
      { status: 422 },
    );
  }

  if (!fields.ctwaClid) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "no_ctwa_clid",
    });
  }

  const createTime = inboundContactCreateTimeCandidate(
    fields.sendTime,
    fields.envelopeCreateTime,
  );

  try {
    const contact = await upsertContactByPhone({
      phoneNumber: fields.phoneNumber,
      name: fields.name,
      createTime,
    });

    await db
      .insert(ctwaSessions)
      .values({
        contactId: contact.id,
        ctwaClid: fields.ctwaClid,
        wabaId: fields.wabaId,
        sourceId: fields.sourceId,
        sourceUrl: fields.sourceUrl,
        sourceType: fields.sourceType,
        sendTime: createTime,
      })
      .onConflictDoNothing({
        target: [
          ctwaSessions.contactId,
          ctwaSessions.ctwaClid,
          ctwaSessions.sendTime,
        ],
      });
  } catch (e) {
    console.error("[ycloud webhook] insert failed", e);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
