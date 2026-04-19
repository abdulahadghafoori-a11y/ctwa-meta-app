ALTER TABLE "ctwa_sessions" ADD COLUMN "source_id" text;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "source_url" text;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "source_type" text;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "envelope_create_time" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "send_time" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "whatsapp_from" text;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "from_user_id" text;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ADD COLUMN "customer_profile" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "ctwa_sessions" SET
  "send_time" = "message_timestamp",
  "whatsapp_from" = "phone_number",
  "source_id" = "referral_data"->>'source_id',
  "source_url" = "referral_data"->>'source_url',
  "source_type" = "referral_data"->>'source_type',
  "customer_profile" = CASE
    WHEN "customer_name" IS NOT NULL AND trim("customer_name") <> ''
    THEN jsonb_build_object('name', "customer_name")
    ELSE '{}'::jsonb
  END
WHERE "send_time" IS NULL;
--> statement-breakpoint
UPDATE "ctwa_sessions" SET "ctwa_clid" = COALESCE("ctwa_clid", "referral_data"->>'ctwa_clid') WHERE "ctwa_clid" IS NULL OR trim("ctwa_clid") = '';
--> statement-breakpoint
DELETE FROM "ctwa_sessions" WHERE "ctwa_clid" IS NULL OR trim("ctwa_clid") = '';
--> statement-breakpoint
DROP INDEX IF EXISTS "ctwa_sessions_phone_number_idx";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" DROP COLUMN "phone_number";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" DROP COLUMN "customer_name";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" DROP COLUMN "referral_data";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" DROP COLUMN "message_id";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" DROP COLUMN "message_timestamp";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ALTER COLUMN "send_time" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ALTER COLUMN "whatsapp_from" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" ALTER COLUMN "ctwa_clid" SET NOT NULL;
--> statement-breakpoint
DELETE FROM "ctwa_sessions" AS a
WHERE EXISTS (
  SELECT 1 FROM "ctwa_sessions" AS b
  WHERE b."contact_id" = a."contact_id"
    AND b."ctwa_clid" = a."ctwa_clid"
    AND b."send_time" = a."send_time"
    AND b."id" < a."id"
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ctwa_sessions_contact_ctwa_send_unique" ON "ctwa_sessions" ("contact_id", "ctwa_clid", "send_time");
