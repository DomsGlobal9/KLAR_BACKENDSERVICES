// services/email-webhook.service.ts
import { simpleParser } from 'mailparser';
import { v4 as uuidv4 } from 'uuid';
import { emailMessageRepository } from '../repositories/email-message.repository';
import axios from 'axios'; // ✅ ADD THIS

const extractEmails = (field: any): string[] => {
    if (!field) return [];
    if (Array.isArray(field)) {
        return field.flatMap((item) =>
            item.value?.map((v: any) => v.address) || []
        );
    }
    return field.value?.map((v: any) => v.address) || [];
};

export const emailWebhookService = {
    async processIncomingEmail(notification: any) {
        // ✅ ADD LOGGING
        console.log('📨 Notification received:', notification.Type);

        if (notification.Type === 'SubscriptionConfirmation') {
            console.log('✅ Subscription confirmation received');
            console.log('🔗 SubscribeURL:', notification.SubscribeURL);
            
            // ✅ ACTUALLY CONFIRM THE SUBSCRIPTION
            try {
                const response = await axios.get(notification.SubscribeURL);
                console.log('✅ Subscription confirmed successfully!');
                return { 
                    type: 'subscription', 
                    message: 'Subscription confirmed successfully' 
                };
            } catch (error: any) {
                console.error('❌ Failed to confirm subscription:', error.message);
                return { 
                    type: 'subscription', 
                    error: `Failed to confirm: ${error.message}` 
                };
            }
        }

        if (notification.Type === 'Notification') {
            console.log('📧 Email notification received');
            
            try {
                const message = JSON.parse(notification.Message);
                const parsedEmail = await simpleParser(message.content);

                const subject = parsedEmail.subject || '';
                let trackingId = subject.match(/\[TID:([^\]]+)\]/)?.[1] || uuidv4();

                const savedEmail = await emailMessageRepository.saveIncomingEmail({
                    trackingId: trackingId,
                    parentTrackingId: trackingId,
                    messageId: parsedEmail.messageId,
                    inReplyTo: parsedEmail.inReplyTo?.[0] || null,
                    fromEmail: parsedEmail.from?.text || '',
                    toEmail: extractEmails(parsedEmail.to),
                    ccEmail: extractEmails(parsedEmail.cc),
                    bccEmail: extractEmails(parsedEmail.bcc),
                    subject: subject,
                    body: parsedEmail.text || '',
                    htmlBody: parsedEmail.html || '',
                    attachments: parsedEmail.attachments?.map((a: any) => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size,
                        content: a.content ? `data:${a.contentType || 'application/octet-stream'};base64,${a.content.toString('base64')}` : undefined,
                    })) || [],
                    status: 'received',
                    rawHeaders: parsedEmail.headers || null,
                });

                return {
                    type: 'email',
                    success: true,
                    trackingId: trackingId,
                    email: {
                        from: parsedEmail.from?.text || '',
                        to: extractEmails(parsedEmail.to),
                        subject: parsedEmail.subject || '',
                        body: parsedEmail.text || '',
                        htmlBody: parsedEmail.html || '',
                        receivedAt: savedEmail?.createdAt || new Date().toISOString(),
                    }
                };
            } catch (error: any) {
                console.error('❌ Error processing email:', error.message);
                return { error: `Failed to process email: ${error.message}` };
            }
        }

        console.warn('⚠️ Unknown notification type:', notification.Type);
        return { type: 'unknown', error: 'Invalid notification' };
    }
};