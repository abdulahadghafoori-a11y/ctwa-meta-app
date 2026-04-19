ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_value_matches_line";
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_sale_price" numeric(14, 4) NOT NULL,
	"line_value" numeric(14, 4) NOT NULL,
	CONSTRAINT "order_items_line_matches" CHECK (round("line_value", 4) = round(("unit_sale_price" * "quantity"::numeric), 4))
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");
--> statement-breakpoint
INSERT INTO "order_items" ("order_id", "product_id", "quantity", "unit_sale_price", "line_value")
SELECT "id", "product_id", "quantity", "unit_sale_price", "value"
FROM "orders";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "product_id";
--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "quantity";
--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "unit_sale_price";
--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "notes";
