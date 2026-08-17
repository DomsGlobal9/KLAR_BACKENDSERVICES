import { envConfig } from './env.config';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    leadId?: string;
    contactId?: string;
    trackingId?: string;
    parentTrackingId?: string;
    inReplyTo?: string;
    references?: string;
    userId?: string;
    user_mail?: string,
    user_name?: string
    attachments?: Array<{
        filename: string;
        path?: string;
        content?: Buffer | string;
        contentType?: string;
    }>;
}

export const emailConfig = {
    from: envConfig.SES_FROM_EMAIL,
    region: envConfig.AWS_REGION,
    bucketName: envConfig.AWS_BUCKET_NAME,
    domain: envConfig.EMAIL_DOMAIN,
    credentials: {
        accessKeyId: envConfig.AWS_ACCESS_KEY,
        secretAccessKey: envConfig.AWS_SECRET_KEY,
    },
};