import axios from 'axios';
import { GetObjectCommand, S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { simpleParser, AddressObject } from 'mailparser';
import { Readable } from 'stream';
import { emailConfig } from '../config/email.config';
import { emailMessageRepository } from '../repositories/email-message.repository';
import { randomUUID } from 'crypto';

class EmailReceiveService {
    private s3: S3Client;

    constructor() {
        this.s3 = new S3Client({
            region: emailConfig.region,
            credentials: emailConfig.credentials,
        });
    }

    async processSNS(payload: any): Promise<{ message: string; email?: any }> {
        if (payload.Type === 'SubscriptionConfirmation') {
            await axios.get(payload.SubscribeURL);
            return {
                message: 'Subscription confirmed',
            };
        }

        if (payload.Type === 'Notification') {
            let message = payload.Message;

            if (typeof message === 'string') {
                try {
                    message = JSON.parse(message);
                } catch (error) {
                    throw new Error('Invalid SNS message format');
                }
            }

            let email;
            let bucket;
            let key;

            if (message.receipt?.action?.type === 'S3') {
                bucket = message.receipt.action.bucketName || message.receipt.action.bucket;
                key = message.receipt.action.objectKey || message.receipt.action.objectKeyName;

                if (!bucket || !key) {
                    throw new Error('Missing bucket or key in SNS message');
                }

                email = await this.downloadEmail(bucket, key);
            } else if (message.content) {
                const emailContent = Buffer.from(message.content, 'base64').toString('utf-8');
                email = await simpleParser(emailContent);
            } else {
                throw new Error('No email content or S3 reference found in SNS message');
            }

            const parsedEmail = this.parseEmail(email);
            await this.saveIncomingEmail(parsedEmail);

            return {
                message: 'Email processed successfully',
                email: parsedEmail,
            };
        }

        return {
            message: 'Ignored SNS message',
        };
    }

    async getAllEmails(bucket?: string, maxKeys?: number): Promise<any[]> {
        const targetBucket = bucket || emailConfig.bucketName;
        const limit = maxKeys || 100;

        const listCommand = new ListObjectsV2Command({
            Bucket: targetBucket,
            MaxKeys: limit,
        });

        const response = await this.s3.send(listCommand);

        if (!response.Contents || response.Contents.length === 0) {
            return [];
        }

        const emails = await Promise.all(
            response.Contents
                .filter(item => item.Key)
                .map(async (item) => {
                    try {
                        const email = await this.downloadEmail(targetBucket, item.Key!);
                        const parsedEmail = this.parseEmail(email);
                        await this.saveIncomingEmail(parsedEmail);
                        return parsedEmail;
                    } catch (error) {
                        return null;
                    }
                })
        );

        return emails.filter(email => email !== null);
    }

    private async saveIncomingEmail(parsedEmail: any) {
        const toEmailArray = Array.isArray(parsedEmail.toEmail)
            ? parsedEmail.toEmail
            : (parsedEmail.toEmail ? [parsedEmail.toEmail] : []);

        const isFromYourDomain = parsedEmail.fromEmail?.includes(emailConfig.domain) ||
            parsedEmail.fromEmail === emailConfig.from;

        if (isFromYourDomain && toEmailArray.length > 0) {
            const existingOutgoing = await emailMessageRepository.findOutgoingBySubjectAndTo(
                parsedEmail.subject,
                toEmailArray
            );

            if (existingOutgoing) {
                return existingOutgoing;
            }
        }

        const existingEmail = await emailMessageRepository.getByMessageId(parsedEmail.messageId);
        if (existingEmail) {
            if ((!existingEmail.body || existingEmail.body.trim() === '' || !existingEmail.htmlBody || existingEmail.htmlBody.trim() === '') && (parsedEmail.text || parsedEmail.html)) {
                const updated = await emailMessageRepository.updateEmailBody(
                    existingEmail.id,
                    parsedEmail.text || '',
                    parsedEmail.html || ''
                );
                return updated || existingEmail;
            }
            return existingEmail;
        }

        const trackingId = parsedEmail.inReplyTo
            ? await this.getParentTrackingId(parsedEmail.inReplyTo) || randomUUID()
            : randomUUID();

        const emailData = {
            trackingId,
            parentTrackingId: parsedEmail.inReplyTo
                ? await this.getParentTrackingId(parsedEmail.inReplyTo)
                : null,
            messageId: parsedEmail.messageId,
            inReplyTo: parsedEmail.inReplyTo,
            references: parsedEmail.references,
            direction: 'incoming',
            fromEmail: parsedEmail.fromEmail,
            fromName: parsedEmail.fromName,
            toEmail: toEmailArray,
            ccEmail: Array.isArray(parsedEmail.ccEmail) ? parsedEmail.ccEmail : (parsedEmail.ccEmail ? [parsedEmail.ccEmail] : []),
            bccEmail: Array.isArray(parsedEmail.bccEmail) ? parsedEmail.bccEmail : (parsedEmail.bccEmail ? [parsedEmail.bccEmail] : []),
            subject: parsedEmail.subject,
            body: parsedEmail.text,
            htmlBody: parsedEmail.html,
            attachments: parsedEmail.attachments || [],
            rawHeaders: parsedEmail.headers,
            status: 'received',
            receivedAt: parsedEmail.date || new Date(),
        };

        return await emailMessageRepository.saveIncomingEmail(emailData);
    }

    private async getParentTrackingId(inReplyTo: string): Promise<string | null> {
        const parentEmail = await emailMessageRepository.getByMessageId(inReplyTo);
        return parentEmail?.trackingId || null;
    }

    private parseEmail(email: any) {
        const getEmailDetails = (addressField: AddressObject | AddressObject[] | undefined) => {
            if (!addressField) return { text: undefined, addresses: [], names: [] };

            if (Array.isArray(addressField)) {
                const allAddresses: string[] = [];
                const allNames: string[] = [];
                const allTexts: string[] = [];

                addressField.forEach(item => {
                    if (item.value) {
                        item.value.forEach(v => {
                            if (v.address) allAddresses.push(v.address);
                            if (v.name) allNames.push(v.name);
                        });
                    }
                    if (item.text) allTexts.push(item.text);
                });

                return {
                    text: allTexts.join(', ') || undefined,
                    addresses: allAddresses,
                    names: allNames
                };
            }

            return {
                text: addressField.text,
                addresses: addressField.value?.map(v => v.address).filter(Boolean) as string[] || [],
                names: addressField.value?.map(v => v.name).filter(Boolean) as string[] || []
            };
        };

        const getFirstFromAddress = (fromField: AddressObject | AddressObject[] | undefined) => {
            if (!fromField) return { name: undefined, email: undefined, text: undefined };

            const from = Array.isArray(fromField) ? fromField[0] : fromField;

            return {
                text: from.text,
                name: from.value?.[0]?.name,
                email: from.value?.[0]?.address
            };
        };

        const fromDetails = getFirstFromAddress(email.from);
        const toDetails = getEmailDetails(email.to);
        const ccDetails = getEmailDetails(email.cc);
        const bccDetails = getEmailDetails(email.bcc);

        let rawHtml: string | undefined = undefined;
        if (typeof email.html === 'string' && email.html.trim().length > 0) {
            rawHtml = email.html;
        } else if (typeof email.textAsHtml === 'string' && email.textAsHtml.trim().length > 0) {
            rawHtml = email.textAsHtml;
        }

        let rawText: string | undefined = undefined;
        if (typeof email.text === 'string' && email.text.trim().length > 0) {
            rawText = email.text;
        }

        // Clean HTML
        const htmlContent = rawHtml ? this.cleanHtml(rawHtml) : undefined;

        // Convert HTML to clean plain text if text is missing or single-line (Titan Mail)
        let textContent = rawText;
        if (!textContent && htmlContent) {
            textContent = this.htmlToText(htmlContent);
        } else if (textContent && htmlContent && !textContent.includes('\n') && htmlContent.includes('</div>')) {
            textContent = this.htmlToText(htmlContent);
        }

        const finalHtml = htmlContent || (textContent ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${textContent}</div>` : '');

        return {
            messageId: email.messageId,
            from: fromDetails.text,
            fromName: fromDetails.name,
            fromEmail: fromDetails.email,
            to: toDetails.text,
            toEmail: toDetails.addresses,
            cc: ccDetails.text,
            ccEmail: ccDetails.addresses,
            bcc: bccDetails.text,
            bccEmail: bccDetails.addresses,
            subject: email.subject || '',
            text: textContent || '',
            html: finalHtml || '',
            date: email.date,
            inReplyTo: email.inReplyTo,
            references: email.references,
            headers: email.headers,
            attachments: email.attachments?.map((a: any) => ({
                filename: a.filename,
                contentType: a.contentType,
                size: a.size,
                content: a.content ? `data:${a.contentType || 'application/octet-stream'};base64,${a.content.toString('base64')}` : undefined
            })) || []
        };
    }

    private cleanHtml(html: string): string {
        if (!html) return '';
        return html
            .replace(/<img[^>]*class=["']?[^"']*flm-open[^"']*["']?[^>]*>/gi, '')
            .replace(/<img[^>]*width=["']?0["']?[^>]*height=["']?0["']?[^>]*>/gi, '')
            .trim();
    }

    private htmlToText(html: string): string {
        if (!html) return '';
        return html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/[ \t]+/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    private async downloadEmail(bucket: string, key: string) {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const response = await this.s3.send(command);
        const stream = response.Body as Readable;
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }

        const buffer = Buffer.concat(chunks);
        return simpleParser(buffer);
    }
}

export const emailReceiveService = new EmailReceiveService();