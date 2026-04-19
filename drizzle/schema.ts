import { desc, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** One row per WhatsApp identity (normalized phone). */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneNumber: text("phone_number").notNull(),
    name: text("name"),
    countryCode: text("country_code"),
    countryName: text("country_name"),
    /** Earliest event time across webhook sources (LEAST merge on upsert). */
    createTime: timestamp("create_time", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("contacts_phone_number_unique").on(t.phoneNumber)],
);

export const ctwaSessions = pgTable(
  "ctwa_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    ctwaClid: text("ctwa_clid").notNull(),
    sourceId: text("source_id"),
    sourceUrl: text("source_url"),
    sourceType: text("source_type"),
    envelopeCreateTime: timestamp("envelope_create_time", {
      withTimezone: true,
    }),
    sendTime: timestamp("send_time", { withTimezone: true }).notNull(),
    /** Normalized digits only (same as contacts.phone_number) for matching. */
    phoneNumber: text("phone_number").notNull(),
    customerProfile: jsonb("customer_profile")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ctwa_sessions_contact_id_idx").on(t.contactId),
    index("ctwa_sessions_ctwa_clid_idx").on(t.ctwaClid),
    index("ctwa_sessions_phone_number_idx").on(t.phoneNumber),
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
    /** Default unit sale price (USD). */
    defaultSalePrice: numeric("default_sale_price", {
      precision: 14,
      scale: 4,
    }).notNull(),
    /** Unit cost of goods sold (USD). */
    cogs: numeric("cogs", { precision: 14, scale: 4 }).notNull().default("0"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("products_sku_unique").on(t.sku)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id").notNull(),
    phoneNumber: text("phone_number").notNull(),
    /** Denormalized attribution; optional FKs for reporting / audit. */
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    ctwaSessionId: uuid("ctwa_session_id").references(() => ctwaSessions.id, {
      onDelete: "set null",
    }),
    ctwaClid: text("ctwa_clid"),
    /** Sum of line totals (USD). */
    value: numeric("value", { precision: 14, scale: 4 }).notNull(),
    /** Always USD in this app. */
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
    uniqueIndex("orders_order_id_unique").on(t.orderId),
    index("orders_contact_id_idx").on(t.contactId),
    index("orders_ctwa_session_id_idx").on(t.ctwaSessionId),
    index("orders_phone_ctwa_idx").on(t.phoneNumber, t.ctwaClid),
    index("orders_phone_created_idx").on(t.phoneNumber, desc(t.createdAt)),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
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
  (t) => [index("order_items_order_id_idx").on(t.orderId)],
);

export type Contact = typeof contacts.$inferSelect;
export type CtwaSession = typeof ctwaSessions.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
