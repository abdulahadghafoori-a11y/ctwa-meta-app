ALTER TABLE "products" RENAME COLUMN "price" TO "default_sale_price";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cogs" numeric(14, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "unit_sale_price" numeric(14, 4);--> statement-breakpoint
UPDATE "orders" SET "unit_sale_price" = ("value" / ("quantity")::numeric) WHERE "unit_sale_price" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "unit_sale_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD';
