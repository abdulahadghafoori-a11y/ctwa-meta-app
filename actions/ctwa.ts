"use server";

import { desc, eq } from "drizzle-orm";

import { ctwaSessions } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { normalizePhoneDigits } from "@/lib/phone";

export type CtwaSessionRow = {
  id: string;
  contactId: string;
  ctwaClid: string;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  envelopeCreateTime: string | null;
  sendTime: string;
  phoneNumber: string;
  customerProfile: Record<string, unknown>;
  createdAt: string;
};

export async function getCtwaSessionsByPhone(
  rawPhone: string,
): Promise<CtwaSessionRow[]> {
  const digits = normalizePhoneDigits(rawPhone);
  if (!digits) return [];

  const rows = await db
    .select()
    .from(ctwaSessions)
    .where(eq(ctwaSessions.phoneNumber, digits))
    .orderBy(desc(ctwaSessions.sendTime));

  return rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    ctwaClid: r.ctwaClid,
    sourceId: r.sourceId,
    sourceUrl: r.sourceUrl,
    sourceType: r.sourceType,
    envelopeCreateTime: r.envelopeCreateTime?.toISOString() ?? null,
    sendTime: r.sendTime.toISOString(),
    phoneNumber: r.phoneNumber,
    customerProfile: r.customerProfile,
    createdAt: r.createdAt.toISOString(),
  }));
}
