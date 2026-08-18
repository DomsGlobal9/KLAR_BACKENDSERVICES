CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_id" text NOT NULL,
	"parent_tracking_id" text,
	"message_id" text,
	"in_reply_to" text,
	"references" text,
	"direction" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_email" text[] NOT NULL,
	"cc_email" text[],
	"bcc_email" text[],
	"subject" text,
	"body" text,
	"html_body" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"raw_headers" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"lead_id" uuid,
	"contact_id" uuid,
	"is_read" boolean DEFAULT false,
	"sent_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_email_messages_tracking_id" ON "email_messages" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_parent_tracking_id" ON "email_messages" USING btree ("parent_tracking_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_message_id" ON "email_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_lead_id" ON "email_messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_contact_id" ON "email_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_direction" ON "email_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "idx_email_messages_created_at" ON "email_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_email_messages_sent_at" ON "email_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_email_messages_from_email" ON "email_messages" USING btree ("from_email");--> statement-breakpoint
CREATE INDEX "idx_email_messages_in_reply_to" ON "email_messages" USING btree ("in_reply_to");--> statement-breakpoint
CREATE INDEX "idx_email_messages_status" ON "email_messages" USING btree ("status");