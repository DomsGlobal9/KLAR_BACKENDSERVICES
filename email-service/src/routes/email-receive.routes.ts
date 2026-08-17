import { Router } from 'express';
import { emailReceiveController } from '../controllers/email-receive.controller';

const router = Router();

router.post('/sns', emailReceiveController.receiveEmail);
router.get('/all', emailReceiveController.getAllEmails);

export default router;