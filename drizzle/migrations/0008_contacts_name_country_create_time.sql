ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "create_time" timestamp with time zone;
--> statement-breakpoint
UPDATE "contacts" SET "create_time" = "created_at" WHERE "create_time" IS NULL;
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "create_time" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "country_code" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "country_name" text;
--> statement-breakpoint
ALTER TABLE "contacts" RENAME COLUMN "display_name" TO "name";
--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "updated_at";
