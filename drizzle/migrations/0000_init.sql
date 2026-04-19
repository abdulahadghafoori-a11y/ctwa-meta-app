CREATE TABLE "ctwa_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"customer_name" text,
	"ctwa_clid" text,
	"referral_data" jsonb NOT NULL,
	"message_id" text NOT NULL,
	"message_timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"ctwa_clid" text NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"value" numeric(14, 4) NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"capi_sent" boolean DEFAULT false NOT NULL,
	"capi_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"price" numeric(14, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ctwa_sessions_phone_number_idx" ON "ctwa_sessions" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "ctwa_sessions_ctwa_clid_idx" ON "ctwa_sessions" USING btree ("ctwa_clid");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_id_unique" ON "orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_phone_ctwa_idx" ON "orders" USING btree ("phone_number","ctwa_clid");--> statement-breakpoint
CREATE INDEX "orders_phone_created_idx" ON "orders" USING btree ("phone_number","created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("sku");