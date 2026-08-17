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

        try {
            const jobPayload: EmailJobData = {
                dbId: trackingId,
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
            };
        } catch (error: any) {
            console.error('Email queue dispatch error:', error);

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

        for (const email of emails) {
            const trackingId = randomUUID();

            bulkJobsData.push({
                dbId: trackingId,
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