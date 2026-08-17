import { pgTable, uuid, text, timestamp, jsonb, index, boolean } from 'drizzle-orm/pg-core';

export const emailMessages = pgTable('email_messages', {
    id: uuid('id').defaultRandom().primaryKey(),

    trackingId: text('tracking_id').notNull(),
    parentTrackingId: text('parent_tracking_id'),
    messageId: text('message_id'),
    inReplyTo: text('in_reply_to'),
    references: text('references'),

    direction: text('direction').notNull(),

    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    toEmail: text('to_email').array().notNull(),
    ccEmail: text('cc_email').array(),
    bccEmail: text('bcc_email').array(),

    subject: text('subject'),
    body: text('body'),
    htmlBody: text('html_body'),

    attachments: jsonb('attachments').default([]),
    rawHeaders: jsonb('raw_headers'),

    status: text('status').default('pending').notNull(),
    error: text('error'),

    leadId: uuid('lead_id'),
    contactId: uuid('contact_id'),
    userId: uuid('user_id'),
    senderName: text('sender_name'),
    senderEmail: text('sender_email'),
    isRead: boolean('is_read').default(false),

    sentAt: timestamp('sent_at'),
    receivedAt: timestamp('received_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    trackingIdIdx: index('idx_email_messages_tracking_id').on(table.trackingId),
    parentTrackingIdIdx: index('idx_email_messages_parent_tracking_id').on(table.parentTrackingId),
    messageIdIdx: index('idx_email_messages_message_id').on(table.messageId),
    leadIdIdx: index('idx_email_messages_lead_id').on(table.leadId),
    contactIdIdx: index('idx_email_messages_contact_id').on(table.contactId),
    userIdIdx: index('idx_email_messages_user_id').on(table.userId),
    directionIdx: index('idx_email_messages_direction').on(table.direction),
    createdAtIdx: index('idx_email_messages_created_at').on(table.createdAt),
    sentAtIdx: index('idx_email_messages_sent_at').on(table.sentAt),
    fromEmailIdx: index('idx_email_messages_from_email').on(table.fromEmail),
    inReplyToIdx: index('idx_email_messages_in_reply_to').on(table.inReplyTo),
    statusIdx: index('idx_email_messages_status').on(table.status),
}));