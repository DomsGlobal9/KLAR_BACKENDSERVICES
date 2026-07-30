import nodemailer, { Transporter } from 'nodemailer';
import { envConfig } from './env.config';



export interface MailOptions {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: any[];
    headers?: Record<string, string>;
}

class MailConfig {
    private transporter: Transporter;
    private static instance: MailConfig;

    private constructor() {
        this.transporter = nodemailer.createTransport({
            host: envConfig.SMTP_HOST,
            port: envConfig.SMTP_PORT,
            secure: envConfig.SMTP_SECURE,
            auth: {
                user: envConfig.SMTP_USER,
                pass: envConfig.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: envConfig.NODE_ENV === 'production',
            },
        });

        this.verifyConnection();
    }

    public static getInstance(): MailConfig {
        if (!MailConfig.instance) {
            MailConfig.instance = new MailConfig();
        }
        return MailConfig.instance;
    }

    private async verifyConnection(): Promise<void> {
        try {
            await this.transporter.verify();

        } catch (error) {

            throw error;
        }
    }

    public async sendMail(options: MailOptions): Promise<any> {
        const mailOptions = {
            from: {
                address: envConfig.DEFAULT_FROM,
                name: envConfig.DEFAULT_FROM_NAME,
            },
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            cc: options.cc,
            bcc: options.bcc,
            replyTo: options.replyTo || envConfig.DEFAULT_REPLY_TO,
            attachments: options.attachments,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);

            return {
                success: true,
                messageId: info.messageId,
                response: info.response,
            };
        } catch (error) {

            throw error;
        }
    }

    public async sendTestEmail(): Promise<any> {
        const testOptions: MailOptions = {
            to: envConfig.SMTP_USER,
            subject: 'Test Email from Your App',
            text: 'This is a test email sent from your application.',
            html: `
        <h1>Test Email</h1>
        <p>This is a test email sent from your application.</p>
        <p>Time: ${new Date().toLocaleString()}</p>
        <p>Environment: ${envConfig.NODE_ENV}</p>
      `,
        };

        return this.sendMail(testOptions);
    }

    public getTransporter(): Transporter {
        return this.transporter;
    }
}

export const mailConfig = MailConfig.getInstance();