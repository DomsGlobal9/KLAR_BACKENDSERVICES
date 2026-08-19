import { Request, Response } from 'express';
import { emailReceiveService } from '../services/email-receive.service';

export const emailReceiveController = {
    async receiveEmail(req: Request, res: Response) {
        try {
            console.log('\n================ SNS REQUEST RECEIVED ================');
            console.log('Time:', new Date().toISOString());
            console.log('Method:', req.method);
            console.log('URL:', req.originalUrl);
            console.log('Headers:', JSON.stringify(req.headers, null, 2));
            console.log('Body:', JSON.stringify(req.body, null, 2));
            console.log('======================================================\n');

            let payload = req.body;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (error) {
                    console.error('Failed to parse JSON payload:', error);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid JSON payload',
                    });
                }
            }

            const result = await emailReceiveService.processSNS(payload);

            console.log('\n================ SNS RESPONSE ========================');
            console.log(JSON.stringify(result, null, 2));
            console.log('======================================================\n');

            return res.status(200).json({
                success: true,
                message: result.message,
                data: result.email,
            });
        } catch (error: any) {
            console.error('\n================ SNS ERROR ===========================');
            console.error(error);
            console.error('======================================================\n');

            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    },


    async getAllEmails(req: Request, res: Response) {
        try {
            const { bucket, limit } = req.query;

            const emails = await emailReceiveService.getAllEmails(
                bucket as string,
                limit ? parseInt(limit as string) : undefined
            );

            return res.status(200).json({
                success: true,
                count: emails.length,
                data: emails
            });
        } catch (error: any) {
            console.error('[Get All Emails] Error:', error);

            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    },
};