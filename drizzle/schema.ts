import { desc } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * One WhatsApp identity per row (E.164 phone, merged profile from webhooks).
 * `create_time` is the earliest known event time (LEAST on upsert).
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneNumber: text("phone_number").notNull(),
    name: text("name"),
    countryCode: text("country_code"),
    countryName: text("country_name"),
    createTime: timestamp("create_time", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("contacts_phone_number_unique").on(t.phoneNumber)],
);

/**
 * One row per CTWA referral session (unique on contact + clid + send_time).
 * `send_time` is the earliest of message send vs envelope time (and legacy ingest time on migrate).
 * Phone and display name live on `contacts` via `contact_id`.
 * `waba_id` comes from YCloud `whatsappInboundMessage.wabaId` (Meta WABA for CAPI).
 */
export const ctwaSessions = pgTable(
  "ctwa_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    ctwaClid: text("ctwa_clid").notNull(),
    wabaId: text("waba_id"),
    sourceId: text("source_id"),
    sourceUrl: text("source_url"),
    sourceType: text("source_type"),
    sendTime: timestamp("send_time", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("ctwa_sessions_contact_id_idx").on(t.contactId),
    index("ctwa_sessions_ctwa_clid_idx").on(t.ctwaClid),
    uniqueIndex("ctwa_sessions_contact_ctwa_send_unique").on(
      t.contactId,
      t.ctwaClid,
      t.sendTime,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    defaultSalePrice: numeric("default_sale_price", {
      precision: 14,
      scale: 4,
    }).notNull(),
    cogs: numeric("cogs", { precision: 14, scale: 4 }).notNull().default("0"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("products_sku_unique").on(t.sku)],
);

/**
 * Business id is `id` (e.g. ORD-…). Phone and `ctwa_clid` are not stored; resolve via
 * `contact_id` → contacts.phone_number and optional `ctwa_session_id` → ctwa_sessions.ctwa_clid.
 */
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    ctwaSessionId: uuid("ctwa_session_id").references(() => ctwaSessions.id, {
      onDelete: "set null",
    }),
    value: numeric("value", { precision: 14, scale: 4 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull(),
    capiSent: boolean("capi_sent").notNull().default(false),
    capiEventId: text("capi_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("orders_contact_id_idx").on(t.contactId),
    index("orders_ctwa_session_id_idx").on(t.ctwaSessionId),
    index("orders_created_idx").on(desc(t.createdAt)),
  ],
);

/** Line items: composite PK (order id + stable line index). */
export const orderItems = pgTable(
  "order_items",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    lineIndex: integer("line_index").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitSalePrice: numeric("unit_sale_price", {
      precision: 14,
      scale: 4,
    }).notNull(),
    lineValue: numeric("line_value", { precision: 14, scale: 4 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.lineIndex] }),
    index("order_items_order_id_idx").on(t.orderId),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type CtwaSession = typeof ctwaSessions.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
