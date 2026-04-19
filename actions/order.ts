"use server";

import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

import {
  contacts,
  ctwaSessions,
  orderItems,
  orders,
  products,
} from "@/drizzle/schema";
import { db } from "@/lib/db";
import { sendMetaPurchaseEvent } from "@/lib/meta-capi";
import { e164ToDigits, parseToE164 } from "@/lib/phone";
import {
  APP_CURRENCY,
  createOrderSchema,
  type CreateOrderInput,
} from "@/lib/validations/order";

export async function createOrder(
  input: CreateOrderInput,
): Promise<
  { ok: true; orderId: string; capiEventId: string } | { ok: false; error: string }
> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const data = parsed.data;
  const phoneE164 = parseToE164(data.phone);
  if (!phoneE164) {
    return { ok: false, error: "Enter a valid phone number (with country code)." };
  }

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.phoneNumber, phoneE164))
    .limit(1);

  if (!contact) {
    return {
      ok: false,
      error:
        "No contact found for this number. The customer must reach you on WhatsApp first.",
    };
  }

  const productIds = [...new Set(data.lines.map((l) => l.productId))];
  const productRows = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));
  const productById = new Map(productRows.map((p) => [p.id, p]));

  type ResolvedLine = {
    product: (typeof productRows)[0];
    quantity: number;
    unit: number;
    lineValue: number;
  };

  const resolved: ResolvedLine[] = [];
  for (const line of data.lines) {
    const p = productById.get(line.productId);
    if (!p) {
      return { ok: false, error: "One or more products were not found." };
    }
    const unit = line.unitSalePrice;
    const qty = line.quantity;
    const lineValue = unit * qty;
    resolved.push({ product: p, quantity: qty, unit, lineValue });
  }

  const orderTotal = resolved.reduce((s, r) => s + r.lineValue, 0);
  const totalQuantity = resolved.reduce((s, r) => s + r.quantity, 0);

  const orderPk = data.orderId?.trim() || `ORD-${nanoid(10).toUpperCase()}`;

  const sessionIdEmpty =
    !data.ctwaSessionId || data.ctwaSessionId.trim() === "";

  const [anySessionForPhone] = await db
    .select({ id: ctwaSessions.id })
    .from(ctwaSessions)
    .innerJoin(contacts, eq(ctwaSessions.contactId, contacts.id))
    .where(
      and(eq(contacts.phoneNumber, phoneE164), eq(contacts.id, contact.id)),
    )
    .limit(1);

  if (sessionIdEmpty) {
    if (anySessionForPhone) {
      return {
        ok: false,
        error: "Select a CTWA session for this number.",
      };
    }

    const [inserted] = await db
      .insert(orders)
      .values({
        id: orderPk,
        contactId: contact.id,
        ctwaSessionId: null,
        value: orderTotal.toFixed(4),
        currency: APP_CURRENCY,
        status: data.status,
      })
      .returning();

    if (!inserted) {
      return { ok: false, error: "Could not create order." };
    }

    try {
      await db.insert(orderItems).values(
        resolved.map((r, lineIndex) => ({
          orderId: inserted.id,
          lineIndex,
          productId: r.product.id,
          quantity: r.quantity,
          unitSalePrice: r.unit.toFixed(4),
          lineValue: r.lineValue.toFixed(4),
        })),
      );
    } catch (e) {
      console.error("[createOrder] order_items insert failed", e);
      await db.delete(orders).where(eq(orders.id, inserted.id));
      return { ok: false, error: "Could not save order lines." };
    }

    revalidatePath("/");
    revalidatePath("/orders/new");

    return {
      ok: true,
      orderId: orderPk,
      capiEventId: "",
    };
  }

  const [session] = await db
    .select()
    .from(ctwaSessions)
    .where(eq(ctwaSessions.id, data.ctwaSessionId))
    .limit(1);

  if (!session) {
    return { ok: false, error: "CTWA session not found." };
  }
  if (!session.ctwaClid) {
    return {
      ok: false,
      error:
        "This session has no ctwa_clid; pick another row or wait for a CTWA referral.",
    };
  }
  if (session.contactId !== contact.id) {
    return {
      ok: false,
      error: "Selected session does not match the contact for this number.",
    };
  }

  const [inserted] = await db
    .insert(orders)
    .values({
      id: orderPk,
      contactId: session.contactId,
      ctwaSessionId: session.id,
      value: orderTotal.toFixed(4),
      currency: APP_CURRENCY,
      status: data.status,
    })
    .returning();

  if (!inserted) {
    return { ok: false, error: "Could not create order." };
  }

  try {
    await db.insert(orderItems).values(
      resolved.map((r, lineIndex) => ({
        orderId: inserted.id,
        lineIndex,
        productId: r.product.id,
        quantity: r.quantity,
        unitSalePrice: r.unit.toFixed(4),
        lineValue: r.lineValue.toFixed(4),
      })),
    );
  } catch (e) {
    console.error("[createOrder] order_items insert failed", e);
    await db.delete(orders).where(eq(orders.id, inserted.id));
    return { ok: false, error: "Could not save order lines." };
  }

  let capiEventIdResult = "";
  try {
    const { eventId } = await sendMetaPurchaseEvent({
      orderId: orderPk,
      value: orderTotal,
      currency: APP_CURRENCY,
      totalQuantity,
      lines: resolved.map((r) => ({
        sku: r.product.sku,
        productName: r.product.name,
        quantity: r.quantity,
        lineValue: r.lineValue,
      })),
      ctwaClid: session.ctwaClid,
      phoneDigits: e164ToDigits(contact.phoneNumber),
    });
    capiEventIdResult = eventId;

    await db
      .update(orders)
      .set({ capiSent: true, capiEventId: eventId })
      .where(eq(orders.id, inserted.id));
  } catch (e) {
    console.error("[createOrder] Meta CAPI failed", e);
    const message = e instanceof Error ? e.message : "Meta CAPI request failed";
    return {
      ok: false,
      error: `Order saved, but Meta event failed: ${message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/orders/new");

  const [updated] = await db
    .select({ capiEventId: orders.capiEventId })
    .from(orders)
    .where(eq(orders.id, inserted.id))
    .limit(1);

  return {
    ok: true,
    orderId: orderPk,
    capiEventId: updated?.capiEventId ?? capiEventIdResult,
  };
}
