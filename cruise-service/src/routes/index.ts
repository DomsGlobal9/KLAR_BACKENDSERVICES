import { Router } from 'express';
import cruiseRoutes from './cruise.route';

const router = Router();

// Use cruise routes
router.use(cruiseRoutes);

export default router;
