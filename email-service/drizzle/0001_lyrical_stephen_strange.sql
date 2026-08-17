ALTER TABLE "email_messages" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "sender_name" text;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "sender_email" text;--> statement-breakpoint
CREATE INDEX "idx_email_messages_user_id" ON "email_messages" USING btree ("user_id");