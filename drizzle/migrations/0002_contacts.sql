CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_phone_number_unique" ON "contacts" USING btree ("phone_number");
--> statement-breakpoint
INSERT INTO "contacts" ("phone_number")
SELECT DISTINCT "phone_number" FROM "ctwa_sessions";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "contact_id" uuid;
--> statement-breakpoint
UPDATE "ctwa_sessions" AS cs
SET "contact_id" = c."id"
FROM "contacts" AS c
WHERE cs."phone_number" = c."phone_number";
--> statement-breakpoint
UPDATE "contacts" AS con
SET "display_name" = sub."n"
FROM (
  SELECT "phone_number",
    (array_agg("customer_name" ORDER BY "message_timestamp" DESC))[1] AS n
  FROM "ctwa_sessions"
  WHERE "customer_name" IS NOT NULL AND TRIM("customer_name") <> ''
  GROUP BY "phone_number"
) AS sub
WHERE con."phone_number" = sub."phone_number";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ALTER COLUMN "contact_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD CONSTRAINT "ctwa_sessions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ctwa_sessions_contact_id_idx" ON "ctwa_sessions" USING btree ("contact_id");
