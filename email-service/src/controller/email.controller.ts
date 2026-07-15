// email.controller.ts
import { Request, Response } from "express";
import { emailService } from "../services/email.service";
import queueService from "../services/queue.service";
import { envConfig } from "../config/env.config";

class EmailController {

    sendEmail = async (req: Request, res: Response) => {
        try {
            console.log(`📨 [API] Send email request received`, {
                to: Array.isArray(req.body.to) ? req.body.to.join(', ') : req.body.to,
                subject: req.body.subject
            });

            const jobId = await queueService.addEmailJob(req.body);
            
            console.log(`✅ [API] Email queued successfully: ${jobId}`);

            res.status(202).json({
                success: true,
                message: "Email queued successfully",
                jobId,
                status: "queued"
            });
        } catch (error: any) {
            console.error(`❌ [API] Send email error:`, error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    sendBookingConfirmation = async (req: Request, res: Response) => {
        try {
            console.log(`🏨 [API] Booking confirmation request received`, {
                to: Array.isArray(req.body.to) ? req.body.to.join(', ') : req.body.to,
                hotel: req.body.data?.hotelName
            });

            const { to, data } = req.body;
            const html = require("../services/templates").getBookingConfirmationTemplate(data);

            const emailPayload = {
                to,
                subject: `Booking Confirmation - ${data.hotelName} (Ref: ${data.confirmationNumber})`,
                html
            };

            const jobId = await queueService.addEmailJob(emailPayload);

            console.log(`✅ [API] Booking confirmation queued: ${jobId}`);

            res.status(202).json({
                success: true,
                message: "Booking confirmation email queued successfully",
                jobId,
                status: "queued"
            });
        } catch (error: any) {
            console.error(`❌ [API] Booking confirmation error:`, error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    sendBulkEmails = async (req: Request, res: Response) => {
        try {
            console.log(`📦 [API] Bulk email request received`, {
                count: req.body.emails?.length || 0
            });

            if (!req.body.emails || !Array.isArray(req.body.emails)) {
                console.log(`❌ [API] Bulk email validation failed: emails array required`);
                return res.status(400).json({
                    success: false,
                    message: "emails array required"
                });
            }

            const result = await queueService.addBulkEmailJobs(req.body.emails);

            console.log(`✅ [API] Bulk emails queued: ${result.total} jobs`);

            res.status(202).json({
                success: true,
                message: `Queued ${result.total} emails for processing`,
                jobIds: result.jobIds,
                total: result.total,
                status: "queued"
            });
        } catch (error: any) {
            console.error(`❌ [API] Bulk email error:`, error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    sendTestEmail = async (req: Request, res: Response) => {
        try {
            const to = req.body?.to;
            console.log(`🧪 [API] Test email request received`, {
                to: to || envConfig.DEFAULT_FROM || "test@example.com"
            });

            const emailPayload = {
                to: to || envConfig.DEFAULT_FROM || "test@example.com",
                subject: "Test Email",
                text: "Test email working ✅",
                html: "<h2>Test email working ✅</h2>",
            };

            const jobId = await queueService.addEmailJob(emailPayload);

            console.log(`✅ [API] Test email queued: ${jobId}`);

            res.status(202).json({
                success: true,
                message: "Test email queued successfully",
                jobId,
                status: "queued"
            });
        } catch (error: any) {
            console.error(`❌ [API] Test email error:`, error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    validateEmails = (req: Request, res: Response) => {
        console.log(`🔍 [API] Email validation request received`);
        const result = emailService.validateEmails(req.body.emails);
        console.log(`✅ [API] Email validation complete`);
        res.status(200).json(result);
    };

    getServiceStatus = async (_: Request, res: Response) => {
        console.log(`🔍 [API] Service status request received`);
        const status = await emailService.getServiceStatus();
        console.log(`✅ [API] Service status: ${status.status}`);
        res.status(200).json(status);
    };

    healthCheck = async (_: Request, res: Response) => {
        console.log(`🏥 [API] Health check request received`);
        const status = await emailService.getServiceStatus();
        const httpStatus = status.status === "healthy" ? 200 : 503;
        console.log(`🏥 [API] Health check status: ${status.status} (${httpStatus})`);
        res.status(httpStatus).json(status);
    };

    getJobStatus = async (req: Request, res: Response) => {
        try {
            const { jobId } = req.params;
            console.log(`🔍 [API] Checking job status: ${jobId}`);
            
            const status = await queueService.getJobStatus(jobId as string);

            if (status.status === "not_found") {
                console.log(`❌ [API] Job ${jobId} not found`);
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            console.log(`✅ [API] Job ${jobId} status: ${status.status}`);
            res.status(200).json({
                success: true,
                jobId,
                ...status
            });
        } catch (error: any) {
            console.error(`❌ [API] Get job status error:`, error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    getQueueStats = async (_: Request, res: Response) => {
        try {
            console.log(`📊 [API] Queue stats request received`);
            const stats = await queueService.getQueueStats();
            console.log(`✅ [API] Queue stats fetched successfully`);
            res.status(200).json({
                success: true,
                ...stats
            });
        } catch (error: any) {
            console.error(`❌ [API] Get queue stats error:`, error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };
}

export const emailController = new EmailController();