import { Router } from 'express';
import cruiseController from '../controllers/cruise.controller';

const router = Router();

// Submit new cruise enquiry
router.post('/submit', cruiseController.submitEnquiry.bind(cruiseController));

export default router;
