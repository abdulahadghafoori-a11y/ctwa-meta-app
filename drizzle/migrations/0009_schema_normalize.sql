-- CTWA sessions: single event time; drop denormalized / redundant columns
UPDATE ctwa_sessions
SET send_time = LEAST(
  send_time,
  COALESCE(envelope_create_time, send_time),
  created_at
);

DROP INDEX IF EXISTS "ctwa_sessions_phone_number_idx";

ALTER TABLE "ctwa_sessions"
  DROP COLUMN IF EXISTS "phone_number",
  DROP COLUMN IF EXISTS "customer_profile",
  DROP COLUMN IF EXISTS "envelope_create_time",
  DROP COLUMN IF EXISTS "created_at";

-- Orders: ensure contact_id (required on new schema)
UPDATE "orders" AS o
SET "contact_id" = c."id"
FROM "contacts" AS c
WHERE o."contact_id" IS NULL
  AND o."phone_number" = c."phone_number";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "contact_id" IS NULL) THEN
    RAISE EXCEPTION 'Migration 0009: orders.contact_id must be set for all rows';
  END IF;
END $$;

CREATE TABLE "orders_new" (
  "id" text PRIMARY KEY,
  "contact_id" uuid NOT NULL,
  "ctwa_session_id" uuid,
  "value" numeric(14, 4) NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "status" text NOT NULL,
  "capi_sent" boolean NOT NULL DEFAULT false,
  "capi_event_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "orders_new_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "orders_new_ctwa_session_id_ctwa_sessions_id_fk" FOREIGN KEY ("ctwa_session_id") REFERENCES "public"."ctwa_sessions"("id") ON DELETE set null ON UPDATE no action
);

INSERT INTO "orders_new" (
  "id",
  "contact_id",
  "ctwa_session_id",
  "value",
  "currency",
  "status",
  "capi_sent",
  "capi_event_id",
  "created_at",
  "updated_at"
)
SELECT
  "order_id",
  "contact_id",
  "ctwa_session_id",
  "value",
  "currency",
  "status",
  "capi_sent",
  "capi_event_id",
  "created_at",
  "updated_at"
FROM "orders";

CREATE TABLE "order_items_new" (
  "order_id" text NOT NULL,
  "line_index" integer NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "unit_sale_price" numeric(14, 4) NOT NULL,
  "line_value" numeric(14, 4) NOT NULL,
  CONSTRAINT "order_items_new_order_id_orders_new_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders_new"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "order_items_new_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "order_items_new_line_matches" CHECK (round("line_value", 4) = round(("unit_sale_price" * "quantity"::numeric), 4)),
  PRIMARY KEY ("order_id", "line_index")
);

INSERT INTO "order_items_new" (
  "order_id",
  "line_index",
  "product_id",
  "quantity",
  "unit_sale_price",
  "line_value"
)
SELECT
  o."order_id",
  (ROW_NUMBER() OVER (PARTITION BY oi."order_id" ORDER BY oi."id") - 1)::integer,
  oi."product_id",
  oi."quantity",
  oi."unit_sale_price",
  oi."line_value"
FROM "order_items" oi
INNER JOIN "orders" o ON o."id" = oi."order_id";

DROP TABLE "order_items";
DROP TABLE "orders";

ALTER TABLE "orders_new" RENAME TO "orders";
ALTER TABLE "order_items_new" RENAME TO "order_items";

CREATE INDEX "orders_contact_id_idx" ON "orders" USING btree ("contact_id");
CREATE INDEX "orders_ctwa_session_id_idx" ON "orders" USING btree ("ctwa_session_id");
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at" DESC);
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");

ALTER TABLE "orders" RENAME CONSTRAINT "orders_new_contact_id_contacts_id_fk" TO "orders_contact_id_contacts_id_fk";
ALTER TABLE "orders" RENAME CONSTRAINT "orders_new_ctwa_session_id_ctwa_sessions_id_fk" TO "orders_ctwa_session_id_ctwa_sessions_id_fk";
ALTER TABLE "order_items" RENAME CONSTRAINT "order_items_new_order_id_orders_new_id_fk" TO "order_items_order_id_orders_id_fk";
ALTER TABLE "order_items" RENAME CONSTRAINT "order_items_new_product_id_products_id_fk" TO "order_items_product_id_products_id_fk";
ALTER TABLE "order_items" RENAME CONSTRAINT "order_items_new_line_matches" TO "order_items_line_matches";
