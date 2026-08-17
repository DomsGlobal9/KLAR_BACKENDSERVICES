import { Router } from 'express';
import { emailController } from '../controllers/email.controller';

const router = Router();

/**
 * Send email with full options (to, subject, text, html, cc, bcc)
 */
router.post('/send', emailController.sendEmail);

/**
 * Send simple plain text email
 */
router.post('/send-simple', emailController.sendSimpleEmail);

/**
 * Send HTML email
 */
router.post('/send-html', emailController.sendHtmlEmail);

/**
 * Send bulk emails
 */
router.post('/send-bulk', emailController.sendBulkEmails);

/**
 * Queue monitoring & Job inspection routes
 */
router.get('/queue/status', emailController.getQueueStatus);
router.get('/queue/job/:jobId', emailController.getQueueJob);

/**
 * Email logs & message queries
 */
router.get('/all', emailController.getAllEmails);
router.get('/:id', emailController.getEmailById);

export default router;