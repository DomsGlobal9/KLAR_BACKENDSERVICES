import { emailConfig, EmailOptions } from '../config/email.config';
import { emailMessageRepository } from '../repositories/email-message.repository';
import { randomUUID } from 'crypto';
import {
    enqueueEmailJob,
    enqueueBulkEmailJobs,
    getEmailQueueMetrics,
    getJobById,
    EmailJobData,
} from '../queues/email.queue';

export class EmailService {
    async sendEmail(options: EmailOptions): Promise<any> {
        const trackingId = options.trackingId || randomUUID();
        let savedEmail = null;

        try {
            const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
            const ccAddresses = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];
            const bccAddresses = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [];

            const emailData = {
                trackingId,
                parentTrackingId: options.parentTrackingId || null,
                messageId: null,
                inReplyTo: options.inReplyTo || null,
                references: options.references || null,
                direction: 'outgoing',
                fromEmail: emailConfig.from,
                fromName: null,
                toEmail: toAddresses,
                ccEmail: ccAddresses,
                bccEmail: bccAddresses,
                subject: options.subject,
                body: options.text || null,
                htmlBody: options.html || null,
                attachments: options.attachments || [],
                rawHeaders: null,
                status: 'queued',
                error: null,
                leadId: options.leadId || null,
                contactId: options.contactId || null,
                isRead: false,
                sentAt: null,
                receivedAt: null,
                userId: options.userId || null,
                senderName: options.user_name || null,
                senderEmail: options.user_mail || null,
            };

            savedEmail = await emailMessageRepository.saveOutgoingEmail(emailData);

            const jobPayload: EmailJobData = {
                dbId: savedEmail.id,
                trackingId,
                options,
            };

            const queueResult = await enqueueEmailJob(jobPayload);

            return {
                success: true,
                status: 'queued',
                message: 'Email queued for processing',
                jobId: queueResult.jobId,
                trackingId,
                dbId: savedEmail.id,
            };
        } catch (error: any) {
            console.error('Email queue dispatch error:', error);

            if (savedEmail) {
                await emailMessageRepository.updateStatus(savedEmail.id, 'failed', undefined, error.message);
            }

            return {
                success: false,
                status: 'failed',
                error: error.message,
                trackingId,
            };
        }
    }

    async sendSimpleEmail(
        to: string,
        subject: string,
        text: string,
        options?: { leadId?: string; contactId?: string },
        userId?: string
    ): Promise<any> {
        return this.sendEmail({
            to,
            subject,
            text,
            leadId: options?.leadId,
            contactId: options?.contactId,
            userId,
        });
    }

    async sendHtmlEmail(
        to: string,
        subject: string,
        html: string,
        options?: { leadId?: string; contactId?: string }
    ): Promise<any> {
        return this.sendEmail({
            to,
            subject,
            html,
            leadId: options?.leadId,
            contactId: options?.contactId,
        });
    }

    async sendBulkEmails(
        emails: Array<{
            to: string;
            subject: string;
            text?: string;
            html?: string;
            leadId?: string;
            contactId?: string;
        }>
    ): Promise<any> {
        const bulkJobsData: EmailJobData[] = [];
        const savedEmails: any[] = [];

        for (const email of emails) {
            const trackingId = randomUUID();
            const toAddresses = [email.to];

            const emailData = {
                trackingId,
                parentTrackingId: null,
                messageId: null,
                inReplyTo: null,
                references: null,
                direction: 'outgoing',
                fromEmail: emailConfig.from,
                fromName: null,
                toEmail: toAddresses,
                ccEmail: [],
                bccEmail: [],
                subject: email.subject,
                body: email.text || null,
                htmlBody: email.html || null,
                attachments: [],
                rawHeaders: null,
                status: 'queued',
                error: null,
                leadId: email.leadId || null,
                contactId: email.contactId || null,
                userId: (email as any).userId || (email as any).user_id || null,
                senderName: (email as any).senderName || (email as any).user_name || (email as any).userName || null,
                senderEmail: (email as any).senderEmail || (email as any).user_mail || (email as any).user_email || (email as any).userMail || null,
            };

            const saved = await emailMessageRepository.saveOutgoingEmail(emailData);
            savedEmails.push(saved);

            bulkJobsData.push({
                dbId: saved.id,
                trackingId,
                options: {
                    to: email.to,
                    subject: email.subject,
                    text: email.text,
                    html: email.html,
                    leadId: email.leadId,
                    contactId: email.contactId,
                    trackingId,
                },
            });
        }

        const queuedJobs = await enqueueBulkEmailJobs(bulkJobsData);

        return {
            total: emails.length,
            queued: queuedJobs.length,
            status: 'queued',
            jobs: queuedJobs,
        };
    }

    async getQueueStatus() {
        return await getEmailQueueMetrics();
    }

    async getQueueJob(jobId: string) {
        return await getJobById(jobId);
    }

    async getAllEmails(options?: { limit?: number; offset?: number; direction?: 'incoming' | 'outgoing' }) {
        return await emailMessageRepository.getAllEmails(options);
    }

    async getEmailById(id: string) {
        return await emailMessageRepository.getById(id);
    }
}

export const emailService = new EmailService();