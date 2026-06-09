import axios from "axios";
import { envConfig } from "../config/env.config";

interface SendEmailPayload {
    to: string | string[];
    subject: string;
    html: string;
}

export class EmailService {
    /**
     * Send email through email-service (Existing Base Function)
     */
    public static async sendEmail(payload: SendEmailPayload) {
        try {
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

    /**
     * 1. Triggered on Insufficient Balance warning
     */
    public static async sendInsufficientBalanceEmail(toEmails: string | string[], data: { 
        userName: string, 
        requiredAmount: number, 
        currentBalance: number, 
        bookingId: string 
    }) {
        const html = `
            <h3>⚠️ Insufficient Wallet Balance for Booking</h3>
            <p>Dear Admin,</p>
            <p>An attempt to complete booking <strong>#${data.bookingId}</strong> by user <strong>${data.userName}</strong> failed due to insufficient funds.</p>
            <ul>
                <li><strong>Required Amount:</strong> ${data.requiredAmount}</li>
                <li><strong>Current Wallet Balance:</strong> ${data.currentBalance}</li>
                <li><strong>Shortfall Amount:</strong> ${data.requiredAmount - data.currentBalance}</li>
            </ul>
            <p>Please recharge your wallet to proceed with bookings.</p>
        `;
        return this.sendEmail({ to: toEmails, subject: "Alert: Insufficient Wallet Balance", html });
    }

    /**
     * 2. Triggered on Money Deducted (Successful Payment)
     */
    public static async sendPaymentDeductedEmail(toEmails: string | string[], data: { 
        accountName: string, 
        amount: number, 
        bookingId: string, 
        newBalance: number 
    }) {
        const html = `
            <h3>💸 Wallet Debited Confirmation</h3>
            <p>Hello,</p>
            <p>Your wallet associated with account <strong>${data.accountName}</strong> has been successfully debited for booking <strong>#${data.bookingId}</strong>.</p>
            <ul>
                <li><strong>Amount Debited:</strong> ${data.amount}</li>
                <li><strong>Remaining Wallet Balance:</strong> ${data.newBalance}</li>
            </ul>
        `;
        return this.sendEmail({ to: toEmails, subject: `Payment Confirmed - Booking #${data.bookingId}`, html });
    }

    /**
     * 3. Triggered when Admin Recharges Wallet
     */
    public static async sendWalletRechargedEmail(toEmail: string, data: { 
        adminName: string, 
        amount: number, 
        newBalance: number 
    }) {
        const html = `
            <h3>💰 Wallet Recharge Successful</h3>
            <p>Dear ${data.adminName},</p>
            <p>Your wallet recharge transaction has been successfully processed.</p>
            <ul>
                <li><strong>Amount Credited:</strong> ${data.amount}</li>
                <li><strong>Updated Wallet Balance:</strong> ${data.newBalance}</li>
            </ul>
        `;
        return this.sendEmail({ to: toEmail, subject: "Wallet Top-up Successful", html });
    }

    /**
     * 4. Triggered when a Child company pays and drives its balance into negative debt
     */
    public static async sendChildNegativeDebtEmail(parentEmail: string, childEmail: string, data: { 
        childName: string, 
        amount: number, 
        childNewBalance: number 
    }) {
        const html = `
            <h3>📉 Sub-Company Debt Notification</h3>
            <p>Hello,</p>
            <p>Sub-Company <strong>${data.childName}</strong> has utilized parent wallet support to fulfill a payment.</p>
            <ul>
                <li><strong>Transaction Value:</strong> ${data.amount}</li>
                <li><strong>Sub-Company Adjusted Balance (Debt):</strong> ${data.childNewBalance}</li>
            </ul>
            <p>This amount has been secured against the parent company limits.</p>
        `;
        return this.sendEmail({ to: [parentEmail, childEmail], subject: `Alert: Sub-Company Debt Updated (${data.childName})`, html });
    }
}