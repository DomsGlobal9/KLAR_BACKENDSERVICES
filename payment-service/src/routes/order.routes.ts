import express from 'express';
import { createOrderController } from '../controllers/order.controller';

const router = express.Router();

router.post('/create-order', createOrderController);

export default router;