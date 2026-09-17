CREATE TYPE "public"."actor_type" AS ENUM('SYSTEM', 'ADMIN', 'PAYMENT_PROVIDER');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."customer_payment_status" AS ENUM('PENDING', 'PAID', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."order_item_type" AS ENUM('PRODUCT', 'BUNDLE');--> statement-breakpoint
CREATE TYPE "public"."order_seller_settlement_status" AS ENUM('NOT_APPLICABLE', 'PENDING', 'SETTLED');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('ONLINE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('NEW', 'CONFIRMED', 'PREPARED', 'HANDED_TO_SELLER', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('TWINT', 'CARD', 'SELLER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('PENDING', 'SETTLED');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"public_title" text,
	"description" text,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"opening_date" timestamp with time zone,
	"closing_date" timestamp with time zone,
	"default_seller_target_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug"),
	CONSTRAINT "campaigns_dates_order_check" CHECK ("campaigns"."opening_date" IS NULL OR "campaigns"."closing_date" IS NULL OR "campaigns"."opening_date" <= "campaigns"."closing_date"),
	CONSTRAINT "campaigns_default_seller_target_amount_non_negative" CHECK ("campaigns"."default_seller_target_amount" IS NULL OR "campaigns"."default_seller_target_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"unit_price_amount" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_products_campaign_product_unique" UNIQUE("campaign_id","product_id"),
	CONSTRAINT "campaign_products_unit_price_non_negative" CHECK ("campaign_products"."unit_price_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"producer" text,
	"category" text NOT NULL,
	"vintage" integer,
	"region" text,
	"grape_variety" text,
	"short_description" text,
	"description" text,
	"tasting_notes" text,
	"image_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bundle_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "bundle_items_bundle_product_unique" UNIQUE("bundle_id","product_id"),
	CONSTRAINT "bundle_items_quantity_positive" CHECK ("bundle_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text,
	"description" text,
	"image_url" text,
	"price_amount" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "bundles_price_amount_non_negative" CHECK ("bundles"."price_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"target_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_sellers_campaign_seller_unique" UNIQUE("campaign_id","seller_id"),
	CONSTRAINT "campaign_sellers_target_amount_non_negative" CHECK ("campaign_sellers"."target_amount" IS NULL OR "campaign_sellers"."target_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_bundle_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"quantity_per_bundle" integer NOT NULL,
	CONSTRAINT "order_bundle_components_quantity_positive" CHECK ("order_bundle_components"."quantity_per_bundle" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"admin_user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"item_type" "order_item_type" NOT NULL,
	"product_id" uuid,
	"bundle_id" uuid,
	"name_snapshot" text NOT NULL,
	"unit_price_amount" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price_amount" >= 0),
	CONSTRAINT "order_items_line_total_non_negative" CHECK ("order_items"."line_total_amount" >= 0),
	CONSTRAINT "order_items_item_type_reference_consistency" CHECK (("order_items"."item_type" = 'PRODUCT' AND "order_items"."product_id" IS NOT NULL AND "order_items"."bundle_id" IS NULL)
          OR ("order_items"."item_type" = 'BUNDLE' AND "order_items"."bundle_id" IS NOT NULL AND "order_items"."product_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "order_number_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_number_counters_last_value_non_negative" CHECK ("order_number_counters"."last_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source" "order_source" NOT NULL,
	"customer_first_name" text NOT NULL,
	"customer_last_name" text NOT NULL,
	"customer_address" text NOT NULL,
	"customer_postal_code" text NOT NULL,
	"customer_city" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"delivery_note" text,
	"seller_id" uuid,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"status" "order_status" DEFAULT 'NEW' NOT NULL,
	"customer_payment_status" "customer_payment_status" DEFAULT 'PENDING' NOT NULL,
	"seller_settlement_status" "order_seller_settlement_status" DEFAULT 'NOT_APPLICABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"prepared_at" timestamp with time zone,
	"handed_to_seller_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_subtotal_amount_non_negative" CHECK ("orders"."subtotal_amount" >= 0),
	CONSTRAINT "orders_total_amount_non_negative" CHECK ("orders"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_result" text,
	CONSTRAINT "payment_events_provider_event_unique" UNIQUE("provider","provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"provider_payment_id" text,
	"provider_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	CONSTRAINT "payments_amount_non_negative" CHECK ("payments"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "seller_settlement_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_settlement_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "seller_settlement_orders_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "seller_settlement_orders_amount_positive" CHECK ("seller_settlement_orders"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "seller_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "settlement_status" DEFAULT 'PENDING' NOT NULL,
	"settled_at" timestamp with time zone,
	"recorded_by_admin_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_settlements_amount_positive" CHECK ("seller_settlements"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sellers" ADD CONSTRAINT "campaign_sellers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sellers" ADD CONSTRAINT "campaign_sellers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_bundle_components" ADD CONSTRAINT "order_bundle_components_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_bundle_components" ADD CONSTRAINT "order_bundle_components_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_settlement_orders" ADD CONSTRAINT "seller_settlement_orders_seller_settlement_id_seller_settlements_id_fk" FOREIGN KEY ("seller_settlement_id") REFERENCES "public"."seller_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_settlement_orders" ADD CONSTRAINT "seller_settlement_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_settlements" ADD CONSTRAINT "seller_settlements_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_settlements" ADD CONSTRAINT "seller_settlements_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_settlements" ADD CONSTRAINT "seller_settlements_recorded_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("recorded_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_products_campaign_id_idx" ON "campaign_products" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "bundle_items_bundle_id_idx" ON "bundle_items" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "bundles_campaign_id_idx" ON "bundles" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_sellers_campaign_id_idx" ON "campaign_sellers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "order_bundle_components_order_item_id_idx" ON "order_bundle_components" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_bundle_components_product_id_idx" ON "order_bundle_components" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_bundle_id_idx" ON "order_items" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "orders_campaign_id_idx" ON "orders" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "orders_seller_id_idx" ON "orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_customer_payment_status_idx" ON "orders" USING btree ("customer_payment_status");--> statement-breakpoint
CREATE INDEX "payment_events_payment_id_idx" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "seller_settlement_orders_seller_settlement_id_idx" ON "seller_settlement_orders" USING btree ("seller_settlement_id");--> statement-breakpoint
CREATE INDEX "seller_settlements_seller_id_idx" ON "seller_settlements" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "seller_settlements_campaign_id_idx" ON "seller_settlements" USING btree ("campaign_id");