import { Router } from "express";
import { MarkupController } from "../controllers/markup.controller";
import { authenticateJWT as authMiddleware } from "../middlewares/authentication.middleware";

const router = Router();

// // Wallet Routes - All require authentication
// router.get('/my-markup', MarkupController.getMyMarkup);
// router.put('/update', MarkupController.updateMarkup);
// router.post('/preview', MarkupController.calculatePreview);
// export default router;

router.post('/add', authMiddleware, MarkupController.addMarkup);
router.get('/my-markup',authMiddleware, MarkupController.getAll);
router.put('/bulk-update',authMiddleware, MarkupController.bulkUpdate);
router.delete('/:serviceType', authMiddleware, MarkupController.deleteOne);

// NEW: Monthly Revenue
router.get('/monthly-revenue', authMiddleware, MarkupController.getMonthlyRevenue);

export default router;
