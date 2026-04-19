ALTER TABLE "orders" ADD COLUMN "contact_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ctwa_session_id" uuid;
--> statement-breakpoint
UPDATE "orders" AS o
SET "contact_id" = c."id"
FROM "contacts" AS c
WHERE o."phone_number" = c."phone_number";
--> statement-breakpoint
UPDATE "orders" AS o
SET "ctwa_session_id" = s."id"
FROM (
  SELECT DISTINCT ON ("phone_number", "ctwa_clid")
    "id",
    "phone_number",
    "ctwa_clid"
  FROM "ctwa_sessions"
  ORDER BY "phone_number", "ctwa_clid", "message_timestamp" DESC
) AS s
WHERE o."phone_number" = s."phone_number"
  AND o."ctwa_clid" IS NOT DISTINCT FROM s."ctwa_clid";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ctwa_session_id_ctwa_sessions_id_fk" FOREIGN KEY ("ctwa_session_id") REFERENCES "public"."ctwa_sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "orders_contact_id_idx" ON "orders" USING btree ("contact_id");
--> statement-breakpoint
CREATE INDEX "orders_ctwa_session_id_idx" ON "orders" USING btree ("ctwa_session_id");
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_value_matches_line" CHECK (round("value", 4) = round(("unit_sale_price" * "quantity"::numeric), 4));
