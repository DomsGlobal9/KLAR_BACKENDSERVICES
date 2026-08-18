import { Router } from 'express';
import EmailSendRoute from "./email.routes";
import EmailReceiveRoutes from './email-receive.routes';

const router = Router();

/**
 * Base API routes under /api/emails
 */
router.use('/receive', EmailReceiveRoutes);
router.use('/email', EmailSendRoute);

export default router;