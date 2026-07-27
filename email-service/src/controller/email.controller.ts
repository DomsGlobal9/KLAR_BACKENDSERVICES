import { Request, Response } from "express";
import { emailService } from "../services/email.service";
import queueService from "../services/queue.service";
import { envConfig } from "../config/env.config";

class EmailController {

    sendEmail = async (req: Request, res: Response) => {
        try {
            const jobId = await queueService.addEmailJob(req.body);

            res.status(202).json({
                success: true,
                message: "Email queued successfully",
                jobId,
                status: "queued"
            });
        } catch (error: any) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    sendBookingConfirmation = async (req: Request, res: Response) => {
        try {
            const { to, data } = req.body;
            const html = require("../services/templates").getBookingConfirmationTemplate(data);

            const emailPayload = {
                to,
                subject: `Booking Confirmation - ${data.hotelName} (Ref: ${data.confirmationNumber})`,
                html
            };

            const jobId = await queueService.addEmailJob(emailPayload);

            res.status(202).json({
                success: true,
                message: "Booking confirmation email queued successfully",
                jobId,
                status: "queued"
            });
        } catch (error: any) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    sendBulkEmails = async (req: Request, res: Response) => {
        try {
            if (!req.body.emails || !Array.isArray(req.body.emails)) {
                return res.status(400).json({
                    success: false,
                    message: "emails array required"
                });
            }

            const result = await queueService.addBulkEmailJobs(req.body.emails);

            res.status(202).json({
                success: true,
                message: `Queued ${result.total} emails for processing`,
                jobIds: result.jobIds,
                total: result.total,
                status: "queued"
            });
        } catch (error: any) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    sendTestEmail = async (req: Request, res: Response) => {
        try {
            const to = req.body?.to;

            const emailPayload = {
                to: to || envConfig.DEFAULT_FROM || "test@example.com",
                subject: "Test Email",
                text: "Test email working ✅",
                html: "<h2>Test email working ✅</h2>",
            };

            const jobId = await queueService.addEmailJob(emailPayload);

            res.status(202).json({
                success: true,
                message: "Test email queued successfully",
                jobId,
                status: "queued"
            });
        } catch (error: any) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    validateEmails = (req: Request, res: Response) => {
        const result = emailService.validateEmails(req.body.emails);
        res.status(200).json(result);
    };

    getServiceStatus = async (_: Request, res: Response) => {
        const status = await emailService.getServiceStatus();
        res.status(200).json(status);
    };

    healthCheck = async (_: Request, res: Response) => {
        const status = await emailService.getServiceStatus();
        const httpStatus = status.status === "healthy" ? 200 : 503;
        res.status(httpStatus).json(status);
    };

    getJobStatus = async (req: Request, res: Response) => {
        try {
            const { jobId } = req.params;

            const status = await queueService.getJobStatus(jobId as string);

            if (status.status === "not_found") {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            res.status(200).json({
                success: true,
                jobId,
                ...status
            });
        } catch (error: any) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    getQueueStats = async (_: Request, res: Response) => {
        try {
            const stats = await queueService.getQueueStats();
            res.status(200).json({
                success: true,
                ...stats
            });
        } catch (error: any) {

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };
}

export const emailController = new EmailController();