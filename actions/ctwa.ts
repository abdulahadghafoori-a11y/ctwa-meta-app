"use server";

import { desc, eq } from "drizzle-orm";

import { contacts, ctwaSessions } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { parseToE164 } from "@/lib/phone";

export type CtwaSessionRow = {
  id: string;
  contactId: string;
  contactName: string | null;
  ctwaClid: string;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sendTime: string;
};

export async function getCtwaSessionsByPhone(
  rawPhone: string,
): Promise<CtwaSessionRow[]> {
  const e164 = parseToE164(rawPhone);
  if (!e164) return [];

  const rows = await db
    .select({
      id: ctwaSessions.id,
      contactId: ctwaSessions.contactId,
      contactName: contacts.name,
      ctwaClid: ctwaSessions.ctwaClid,
      sourceId: ctwaSessions.sourceId,
      sourceUrl: ctwaSessions.sourceUrl,
      sourceType: ctwaSessions.sourceType,
      sendTime: ctwaSessions.sendTime,
    })
    .from(ctwaSessions)
    .innerJoin(contacts, eq(ctwaSessions.contactId, contacts.id))
    .where(eq(contacts.phoneNumber, e164))
    .orderBy(desc(ctwaSessions.sendTime));

  return rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    contactName: r.contactName,
    ctwaClid: r.ctwaClid,
    sourceId: r.sourceId,
    sourceUrl: r.sourceUrl,
    sourceType: r.sourceType,
    sendTime: r.sendTime.toISOString(),
  }));
}
