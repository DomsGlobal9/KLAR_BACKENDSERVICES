// email.service.ts
import { mailTransporter } from "../app";
import { envConfig } from "../config/env.config";
import { getBookingConfirmationTemplate, BookingTemplateData } from "./templates";

export interface SendEmailPayload {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: any[];
}

export interface EmailResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface BulkEmailPayload {
    emails: SendEmailPayload[];
}

export class EmailService {
    private processRecipients(recipients?: string | string[]) {
        if (!recipients) return [];
        const arr = Array.isArray(recipients) ? recipients : [recipients];
        return [...new Set(arr.map(r => r.trim()))];
    }

    async sendEmail(payload: SendEmailPayload): Promise<EmailResponse> {
        try {
            console.log(`📨 [EMAIL] Preparing to send email`, {
                to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
                subject: payload.subject
            });

            if (!payload.to || !payload.subject) {
                throw new Error("to and subject are required");
            }

            if (!payload.text && !payload.html) {
                throw new Error("Either text or html is required");
            }

            const to = this.processRecipients(payload.to);
            const cc = this.processRecipients(payload.cc);
            const bcc = this.processRecipients(payload.bcc);

            console.log(`📤 [EMAIL] Sending to ${to.length} recipients`);

            const result = await mailTransporter.sendMail({
                from: `"${envConfig.DEFAULT_FROM_NAME}" <${envConfig.DEFAULT_FROM}>`,
                to,
                subject: payload.subject,
                text: payload.text,
                html: payload.html,
                cc: cc.length ? cc : undefined,
                bcc: bcc.length ? bcc : undefined,
                replyTo: payload.replyTo || envConfig.DEFAULT_REPLY_TO,
                attachments: payload.attachments,
            });

            console.log(`✅ [EMAIL] Email sent successfully`, {
                messageId: result.messageId,
                to: to.length,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                messageId: result.messageId,
            };
        } catch (error: any) {
            console.error(`❌ [EMAIL] Email sending failed:`, {
                error: error.message,
                to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
                subject: payload.subject
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async sendBulkEmails(payload: BulkEmailPayload) {
        console.log(`📊 [BULK] Starting bulk email send: ${payload.emails.length} emails`);

        const results = [];
        let success = 0;
        let failed = 0;

        for (const email of payload.emails) {
            const res = await this.sendEmail(email);
            results.push(res);
            res.success ? success++ : failed++;
            console.log(`📊 [BULK] Progress: ${success + failed}/${payload.emails.length} (${success} success, ${failed} failed)`);
            await new Promise(r => setTimeout(r, 100));
        }

        console.log(`✅ [BULK] Bulk email send completed: ${success} success, ${failed} failed`);
        return {
            success: failed === 0,
            total: payload.emails.length,
            successCount: success,
            failedCount: failed,
            results,
        };
    }

    async sendTestEmail(to?: string) {
        console.log(`🧪 [EMAIL] Sending test email to: ${to || envConfig.DEFAULT_FROM}`);
        return this.sendEmail({
            to: to || envConfig.DEFAULT_FROM,
            subject: "Test Email",
            text: "Test email working ✅",
            html: "<h2>Test email working ✅</h2>",
        });
    }

    async sendBookingConfirmation(to: string | string[], data: BookingTemplateData) {
        console.log(`🏨 [EMAIL] Sending booking confirmation to: ${Array.isArray(to) ? to.join(', ') : to}`);
        const html = getBookingConfirmationTemplate(data);
        return this.sendEmail({
            to,
            subject: `Booking Confirmation - ${data.hotelName} (Ref: ${data.confirmationNumber})`,
            html
        });
    }

    validateEmails(emails: string | string[]) {
        console.log(`🔍 [EMAIL] Validating ${Array.isArray(emails) ? emails.length : 1} email(s)`);
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const arr = Array.isArray(emails) ? emails : [emails];

        const valid: string[] = [];
        const invalid: string[] = [];

        arr.forEach(e => (regex.test(e) ? valid.push(e) : invalid.push(e)));

        console.log(`✅ [EMAIL] Validation complete: ${valid.length} valid, ${invalid.length} invalid`);
        return { valid, invalid };
    }

    async getServiceStatus() {
        console.log(`🔍 [EMAIL] Checking service status`);
        try {
            await mailTransporter.verify();
            console.log(`✅ [EMAIL] Service is healthy`);
            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error(`❌ [EMAIL] Service is unhealthy:`, error);
            return {
                status: "unhealthy",
                timestamp: new Date().toISOString(),
            };
        }
    }
}

export const emailService = new EmailService();