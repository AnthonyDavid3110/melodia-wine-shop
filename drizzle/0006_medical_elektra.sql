CREATE TABLE "checkout_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_hash" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "checkout_rate_limits_identity_action_window_unique" UNIQUE("identity_hash","action","window_start"),
	CONSTRAINT "checkout_rate_limits_count_positive" CHECK ("checkout_rate_limits"."count" > 0)
);
--> statement-breakpoint
CREATE INDEX "checkout_rate_limits_window_start_idx" ON "checkout_rate_limits" USING btree ("window_start");