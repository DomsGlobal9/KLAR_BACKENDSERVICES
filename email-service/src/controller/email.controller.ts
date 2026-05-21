import { Request, Response } from "express";
import { emailService } from "../services/email.service";


class EmailController {

  sendEmail = async (req: Request, res: Response) => {

    console.log("@@@@@@@@@@@@@@ EMAIL-CONTROLLER", req.body);
    const result = await emailService.sendEmail(req.body);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }

  };

  sendBookingConfirmation = async (req: Request, res: Response) => {
    const { to, data } = req.body;
    console.log(`[EmailController] Received booking confirmation request for: ${Array.isArray(to) ? to.join(', ') : to}`);
    const result = await emailService.sendBookingConfirmation(to, data);

    if (result.success) {
      console.log(`[EmailController] Booking confirmation sent successfully to: ${Array.isArray(to) ? to.join(', ') : to}`);
      res.status(200).json(result);
    } else {
      console.error(`[EmailController] Failed to send booking confirmation. Error: ${result.error}`);
      res.status(500).json(result);
    }
  };

  sendBulkEmails = async (req: Request, res: Response) => {
    if (!req.body.emails || !Array.isArray(req.body.emails)) {
      return res.status(400).json({ message: "emails array required" });
    }

    const result = await emailService.sendBulkEmails(req.body);
    res.status(200).json(result);
  };

  sendTestEmail = async (req: Request, res: Response) => {
    const result = await emailService.sendTestEmail(req.body?.to);
    res.status(200).json(result);
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

    res.status(status.status === "healthy" ? 200 : 503).json(status);
  };
}

export const emailController = new EmailController();