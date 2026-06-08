import axios from "axios";
import { envConfig } from "../config/env.config";

interface SendEmailPayload {
    to: string | string[];
    subject: string;
    html: string;
}

export class EmailService {
    /**
     * Send email through email-service
     */
    public static async sendEmail(
        payload: SendEmailPayload
    ) {
        console.log("========== EMAIL PAYLOAD ==========");
        console.log(JSON.stringify(payload, null, 2));
        console.log("===================================");
        try {
            console.log("EMAIL PAYLOAD >>>");
            console.log(JSON.stringify(payload, null, 2));
            const response = await axios.post(
                `${envConfig.EMAIL.EMAIL_SERVICE_URL}/email/send`,
                payload
            );

            return response.data;
        } catch (error: any) {
            console.error(
                "Email service error:",
                error?.response?.data || error.message
            );

            throw new Error("Failed to send email");
        }
    }
}