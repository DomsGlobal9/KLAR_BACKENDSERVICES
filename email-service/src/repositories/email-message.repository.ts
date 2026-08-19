import { db } from '../drizzle/db';
import { eq, desc, and, or, like, between, sql } from 'drizzle-orm';
import { emailMessages } from '../drizzle/schemas/email-message.schema';

export const emailMessageRepository = {
    async saveIncomingEmail(data: any) {
        const [result] = await db.insert(emailMessages).values({
            ...data,
            direction: 'incoming',
            status: 'received',
        }).returning();
        return result;
    },

    async saveOutgoingEmail(data: any) {
        const [result] = await db.insert(emailMessages).values({
            ...data,
            direction: 'outgoing',
            status: 'sent',
        }).returning();
        return result;
    },

    async getIncomingEmails(limit?: number, offset?: number) {
        const query = db.select()
            .from(emailMessages)
            .where(eq(emailMessages.direction, 'incoming'))
            .orderBy(desc(emailMessages.createdAt));

        if (limit) {
            query.limit(limit);
        }
        if (offset) {
            query.offset(offset);
        }

        return await query;
    },

    async getOutgoingEmails(limit?: number, offset?: number) {
        const query = db.select()
            .from(emailMessages)
            .where(eq(emailMessages.direction, 'outgoing'))
            .orderBy(desc(emailMessages.createdAt));

        if (limit) {
            query.limit(limit);
        }
        if (offset) {
            query.offset(offset);
        }

        return await query;
    },

    async getConversation(trackingId: string) {
        return await db.select()
            .from(emailMessages)
            .where(eq(emailMessages.trackingId, trackingId))
            .orderBy(emailMessages.createdAt);
    },

    async getThreadByMessageId(messageId: string) {
        const email = await this.getByMessageId(messageId);
        if (!email) return [];

        return await db.select()
            .from(emailMessages)
            .where(
                or(
                    eq(emailMessages.messageId, messageId),
                    eq(emailMessages.inReplyTo, messageId),
                    eq(emailMessages.references, email.references || '')
                )
            )
            .orderBy(emailMessages.createdAt);
    },

    async getById(id: string) {
        const [result] = await db.select()
            .from(emailMessages)
            .where(eq(emailMessages.id, id));
        return result;
    },

    async getByMessageId(messageId: string) {
        const [result] = await db.select()
            .from(emailMessages)
            .where(eq(emailMessages.messageId, messageId));
        return result;
    },

    async getByTrackingId(trackingId: string) {
        return await db.select()
            .from(emailMessages)
            .where(eq(emailMessages.trackingId, trackingId))
            .orderBy(emailMessages.createdAt);
    },

    async getByLeadId(leadId: string) {
        return await db.select()
            .from(emailMessages)
            .where(eq(emailMessages.leadId, leadId))
            .orderBy(desc(emailMessages.createdAt));
    },

    async getByContactId(contactId: string) {
        return await db.select()
            .from(emailMessages)
            .where(eq(emailMessages.contactId, contactId))
            .orderBy(desc(emailMessages.createdAt));
    },

    async updateStatus(id: string, status: string, messageId?: string, error?: string) {
        const updateData: any = {
            status,
            updatedAt: new Date()
        };

        if (messageId) {
            updateData.messageId = messageId;
            updateData.sentAt = new Date();
        }

        if (error) {
            updateData.error = error;
        }

        const [result] = await db.update(emailMessages)
            .set(updateData)
            .where(eq(emailMessages.id, id))
            .returning();
        return result;
    },

    async markAsRead(id: string) {
        const [result] = await db.update(emailMessages)
            .set({ isRead: true, updatedAt: new Date() })
            .where(eq(emailMessages.id, id))
            .returning();
        return result;
    },

    async updateEmailBody(id: string, body: string, htmlBody: string) {
        const [result] = await db.update(emailMessages)
            .set({ body, htmlBody, updatedAt: new Date() })
            .where(eq(emailMessages.id, id))
            .returning();
        return result;
    },

    async checkReplyExists(trackingId: string, inReplyTo: string) {
        const [result] = await db.select()
            .from(emailMessages)
            .where(and(
                eq(emailMessages.trackingId, trackingId),
                eq(emailMessages.inReplyTo, inReplyTo)
            ))
            .limit(1);
        return !!result;
    },

    async searchEmails(searchTerm: string) {
        return await db.select()
            .from(emailMessages)
            .where(
                or(
                    like(emailMessages.subject, `%${searchTerm}%`),
                    like(emailMessages.body, `%${searchTerm}%`),
                    like(emailMessages.fromEmail, `%${searchTerm}%`),
                    sql`${emailMessages.toEmail}::text ILIKE ${`%${searchTerm}%`}`
                )
            )
            .orderBy(desc(emailMessages.createdAt));
    },

    async getEmailsByDateRange(startDate: Date, endDate: Date) {
        return await db.select()
            .from(emailMessages)
            .where(
                between(emailMessages.createdAt, startDate, endDate)
            )
            .orderBy(desc(emailMessages.createdAt));
    },

    async getStats() {
        const [result] = await db.select({
            total: sql<number>`count(*)`,
            incoming: sql<number>`count(case when direction = 'incoming' then 1 end)`,
            outgoing: sql<number>`count(case when direction = 'outgoing' then 1 end)`,
            unread: sql<number>`count(case when is_read = false then 1 end)`,
        }).from(emailMessages);
        return result;
    },

    async deleteEmail(id: string) {
        const [result] = await db.delete(emailMessages)
            .where(eq(emailMessages.id, id))
            .returning();
        return result;
    },

    async findOutgoingBySubjectAndTo(subject: string, toEmail: string[]) {
        if (!toEmail || toEmail.length === 0) {
            return null;
        }

        const toEmailString = toEmail[0];

        const [result] = await db.select()
            .from(emailMessages)
            .where(and(
                eq(emailMessages.subject, subject),
                eq(emailMessages.direction, 'outgoing'),
                sql`${toEmailString} = ANY(${emailMessages.toEmail})`,
                sql`${emailMessages.createdAt} > NOW() - INTERVAL '5 minutes'`
            ))
            .orderBy(desc(emailMessages.createdAt))
            .limit(1);
        return result || null;
    },

    async getAllEmails(options?: { limit?: number; offset?: number; direction?: 'incoming' | 'outgoing' }) {
        const query = db.select()
            .from(emailMessages)
            .orderBy(desc(emailMessages.createdAt));

        if (options?.direction) {
            query.where(eq(emailMessages.direction, options.direction));
        }

        if (options?.limit) {
            query.limit(options.limit);
        }

        if (options?.offset) {
            query.offset(options.offset);
        }

        return await query;
    }
};