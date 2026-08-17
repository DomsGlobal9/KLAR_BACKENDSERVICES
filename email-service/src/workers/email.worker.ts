import { Worker, Job } from 'bullmq';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { EMAIL_QUEUE_NAME, EmailJobData } from '../queues/email.queue';
import { redisConnectionOptions } from '../config/redis.config';
import { emailConfig } from '../config/email.config';
import { emailMessageRepository } from '../repositories/email-message.repository';

const sesClient = new SESClient({
    region: emailConfig.region,
    credentials: emailConfig.credentials,
});

const transporter = nodemailer.createTransport({
    name: 'ses-raw-transport',
    version: '1.0.0',
    send: (mail: any, callback: any) => {
        mail.message.build(async (err: Error | null, message: Buffer) => {
            if (err) {
                return callback(err, null);
            }
            try {
                const command = new SendRawEmailCommand({
                    RawMessage: { Data: message },
                });
                const response = await sesClient.send(command);
                callback(null, { messageId: response.MessageId || '' });
            } catch (sendErr: any) {
                callback(sendErr, null);
            }
        });
    },
} as any);

let emailWorker: Worker<EmailJobData> | null = null;

export const initEmailWorker = (): Worker<EmailJobData> => {
    if (emailWorker) return emailWorker;

    emailWorker = new Worker<EmailJobData>(
        EMAIL_QUEUE_NAME,
        async (job: Job<EmailJobData>) => {
            const { dbId, trackingId, options } = job.data;

            try {
                const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
                const ccAddresses = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];
                const bccAddresses = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [];

                const nodemailerAttachments = options.attachments?.map((att: any) => {
                    let content: Buffer | string | undefined;
                    if (typeof att.content === 'string') {
                        const base64Data = att.content.replace(/^data:[^;]+;base64,/, '');
                        content = Buffer.from(base64Data, 'base64');
                    } else if (Buffer.isBuffer(att.content)) {
                        content = att.content;
                    } else {
                        content = att.path;
                    }
                    return {
                        filename: att.filename,
                        content,
                        contentType: att.contentType,
                    };
                });

                const mailOptions: nodemailer.SendMailOptions = {
                    from: emailConfig.from,
                    to: toAddresses,
                    cc: ccAddresses.length > 0 ? ccAddresses : undefined,
                    bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
                    subject: options.subject,
                    text: options.text,
                    html: options.html,
                    attachments: nodemailerAttachments && nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
                };

                const result = await transporter.sendMail(mailOptions);
                const messageId = result.messageId;

                await emailMessageRepository.updateStatus(dbId, 'sent', messageId);

                return {
                    success: true,
                    messageId,
                    trackingId,
                    dbId,
                };
            } catch (error: any) {
                console.error(`[EmailWorker] Failed job ${job.id} (TrackingId: ${trackingId}):`, error.message);
                await emailMessageRepository.updateStatus(dbId, 'failed', undefined, error.message);
                throw error;
            }
        },
        {
            connection: redisConnectionOptions,
            concurrency: 5,
            limiter: {
                max: 10,
                duration: 1000,
            },
        }
    );

    emailWorker.on('completed', (job, result) => {
        console.log(`[EmailWorker] Job ${job.id} completed. MessageId: ${result.messageId}`);
    });

    emailWorker.on('failed', (job, err) => {
        console.error(`[EmailWorker] Job ${job?.id} failed with error: ${err.message}`);
    });

    return emailWorker;
};

export const closeEmailWorker = async (): Promise<void> => {
    if (emailWorker) {
        try {
            await Promise.race([
                emailWorker.close(true),
                new Promise((resolve) => setTimeout(resolve, 500)),
            ]);
        } catch (err) {
            // ignore
        } finally {
            emailWorker = null;
            console.log('[EmailWorker] Stopped worker.');
        }
    }
};
