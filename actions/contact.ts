"use server";

import { eq } from "drizzle-orm";

import { contacts } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { parseToE164 } from "@/lib/phone";

export type ContactLookup = {
  id: string;
  phoneNumber: string;
  name: string | null;
  countryCode: string | null;
  countryName: string | null;
  createTime: string;
};

export async function getContactByPhone(
  rawPhone: string,
): Promise<ContactLookup | null> {
  const e164 = parseToE164(rawPhone);
  if (!e164) return null;

  const [row] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.phoneNumber, e164))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    phoneNumber: row.phoneNumber,
    name: row.name,
    countryCode: row.countryCode,
    countryName: row.countryName,
    createTime: row.createTime.toISOString(),
  };
}
