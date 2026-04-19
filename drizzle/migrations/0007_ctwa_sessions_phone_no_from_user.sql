DROP INDEX IF EXISTS "ctwa_sessions_whatsapp_from_idx";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" DROP COLUMN IF EXISTS "from_user_id";
--> statement-breakpoint
ALTER TABLE "ctwa_sessions" RENAME COLUMN "whatsapp_from" TO "phone_number";
--> statement-breakpoint
CREATE INDEX "ctwa_sessions_phone_number_idx" ON "ctwa_sessions" ("phone_number");
