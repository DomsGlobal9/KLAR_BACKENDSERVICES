import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { simpleParser } from 'mailparser';
import { emailMessageRepository } from '../repositories/email-message.repository';
import { envConfig } from '../config/env.config';

const s3 = new S3Client({
    region: 'us-east-1',
    credentials: {
        accessKeyId: envConfig.AWS_ACCESS_KEY,
        secretAccessKey: envConfig.AWS_SECRET_KEY,
    },
});


const extractEmails = (field: any): string[] => {
    if (!field) return [];

    if (Array.isArray(field)) {
        return field.flatMap((item) =>
            item.value?.map((v: any) => v.address) || []
        );
    }

    return field.value?.map((v: any) => v.address) || [];
};

export const emailProcessorService = {
    
    async processReceivedEmails() {
        try {
            // List all objects in S3 bucket
            const listCommand = new ListObjectsV2Command({
                Bucket: 'klarworld-receive-emails',
            });
            const listResult = await s3.send(listCommand);

            if (!listResult.Contents || listResult.Contents.length === 0) {
                return { processed: 0 };
            }

            let processed = 0;

            for (const object of listResult.Contents) {
                const key = object.Key!;

                // Skip the setup notification
                if (key === 'AMAZON_SES_SETUP_NOTIFICATION') continue;

                // Get the email content
                const getCommand = new GetObjectCommand({
                    Bucket: 'klarworld-receive-emails',
                    Key: key,
                });
                const getResult = await s3.send(getCommand);
                const rawEmail = await getResult.Body?.transformToString();

                if (!rawEmail) continue;

                // Parse the email
                const parsed = await simpleParser(rawEmail);

                // Extract tracking ID from subject
                let trackingId = parsed.subject?.match(/\[TID:([^\]]+)\]/)?.[1] || null;

                // Save to database
                await emailMessageRepository.saveIncomingEmail({
                    trackingId: trackingId || 'pending',
                    parentTrackingId: null,
                    messageId: parsed.messageId || null,
                    inReplyTo: parsed.inReplyTo?.[0] || null,
                    fromEmail: parsed.from?.text || '',
                    toEmail: extractEmails(parsed.to),
                    ccEmail: extractEmails(parsed.cc),
                    bccEmail: extractEmails(parsed.bcc),
                    subject: parsed.subject || '',
                    body: parsed.text || '',
                    htmlBody: parsed.html || '',
                    attachments: parsed.attachments?.map((a: any) => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size,
                        content: a.content ? `data:${a.contentType || 'application/octet-stream'};base64,${a.content.toString('base64')}` : undefined,
                    })) || [],
                    status: 'received',
                    rawHeaders: parsed.headers || null,
                });

                processed++;
            }

            return { processed };
        } catch (error) {
            console.error('Error processing emails:', error);
            throw error;
        }
    },

    async getEmailContent(key: string) {
        const command = new GetObjectCommand({
            Bucket: 'klarworld-receive-emails',
            Key: key,
        });
        const result = await s3.send(command);
        const rawEmail = await result.Body?.transformToString();
        if (!rawEmail) return null;
        return await simpleParser(rawEmail);
    }
};