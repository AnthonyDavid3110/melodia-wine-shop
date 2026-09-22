ALTER TABLE "payments" ADD COLUMN "return_token" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_return_token_unique" UNIQUE("return_token");