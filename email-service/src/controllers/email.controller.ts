import { Request, Response } from 'express';
import { emailService } from '../services/email.service';

export const emailController = {
    
    async sendEmail(req: Request, res: Response) {
        try {
            const { to, subject, text, html, cc, bcc, leadId, contactId, userId, user_mail, user_name, attachments } = req.body;

            if (!to) {
                return res.status(400).json({
                    success: false,
                    error: 'Recipient email (to) is required',
                });
            }

            if (!subject) {
                return res.status(400).json({
                    success: false,
                    error: 'Subject is required',
                });
            }

            if (!text && !html) {
                return res.status(400).json({
                    success: false,
                    error: 'Either text or html content is required',
                });
            }

            const result = await emailService.sendEmail({
                to,
                subject,
                text,
                html,
                cc,
                bcc,
                leadId,
                contactId,
                userId,
                user_mail,
                user_name,
                attachments
            });

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error,
                });
            }

            res.status(202).json({
                success: true,
                status: 'queued',
                message: 'Email queued successfully for delivery',
                data: {
                    jobId: result.jobId,
                    trackingId: result.trackingId,
                    dbId: result.dbId,
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    },

    async sendSimpleEmail(req: Request, res: Response) {
        try {
            const { to, subject, text, leadId, contactId, userId, user_mail, user_name } = req.body;

            if (!to || !subject || !text) {
                return res.status(400).json({
                    success: false,
                    error: 'to, subject, and text are required',
                });
            }

            const result = await emailService.sendSimpleEmail(to, subject, text, { leadId, contactId }, userId);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error,
                });
            }

            res.status(202).json({
                success: true,
                status: 'queued',
                message: 'Email queued successfully for delivery',
                data: {
                    jobId: result.jobId,
                    trackingId: result.trackingId,
                    dbId: result.dbId,
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    },

    async sendHtmlEmail(req: Request, res: Response) {
        try {
            const { to, subject, html, leadId, contactId, userId } = req.body;

            if (!to || !subject || !html) {
                return res.status(400).json({
                    success: false,
                    error: 'to, subject, and html are required',
                });
            }

            const result = await emailService.sendHtmlEmail(to, subject, html, { leadId, contactId });

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error,
                });
            }

            res.status(202).json({
                success: true,
                status: 'queued',
                message: 'Email queued successfully for delivery',
                data: {
                    jobId: result.jobId,
                    trackingId: result.trackingId,
                    dbId: result.dbId,
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    },

    async sendBulkEmails(req: Request, res: Response) {
        try {
            const { emails, userId } = req.body;

            if (!emails || !Array.isArray(emails) || emails.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'emails array is required',
                });
            }

            const result = await emailService.sendBulkEmails(emails);

            res.status(202).json({
                success: true,
                status: 'queued',
                message: `Queued ${result.queued} out of ${result.total} emails for background delivery`,
                data: {
                    total: result.total,
                    queuedCount: result.queued,
                    jobs: result.jobs,
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    },

    async getQueueStatus(req: Request, res: Response) {
        try {
            const metrics = await emailService.getQueueStatus();
            return res.status(200).json({
                success: true,
                data: metrics,
            });
        } catch (error: any) {
            console.error('[Get Queue Status] Error:', error);
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    },

    async getQueueJob(req: Request, res: Response) {
        try {
            const jobId = req.params.jobId as string;
            if (!jobId) {
                return res.status(400).json({
                    success: false,
                    message: 'Job ID is required',
                });
            }

            const job = await emailService.getQueueJob(jobId);
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found in queue',
                });
            }

            return res.status(200).json({
                success: true,
                data: job,
            });
        } catch (error: any) {
            console.error('[Get Queue Job] Error:', error);
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    },

    async getAllEmails(req: Request, res: Response) {
        try {
            const { limit, offset, direction } = req.query;

            const emails = await emailService.getAllEmails({
                limit: limit ? parseInt(limit as string) : undefined,
                offset: offset ? parseInt(offset as string) : undefined,
                direction: direction as 'incoming' | 'outgoing' | undefined,
            });

            return res.status(200).json({
                success: true,
                count: emails.length,
                data: emails,
            });
        } catch (error: any) {
            console.error('[Get All Emails] Error:', error);
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    },

    async getEmailById(req: Request, res: Response) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Email ID is required',
                });
            }

            const email = await emailService.getEmailById(id as string);

            if (!email) {
                return res.status(404).json({
                    success: false,
                    message: 'Email not found',
                });
            }

            return res.status(200).json({
                success: true,
                data: email,
            });
        } catch (error: any) {
            console.error('[Get Email By Id] Error:', error);
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    },
};