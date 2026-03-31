import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";
import { authenticateJWT as authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Wallet Routes - All require authentication
router.get("/", authMiddleware, WalletController.getWallet);
router.post("/credit", authMiddleware, WalletController.creditWallet);
router.post("/debit", authMiddleware, WalletController.debitWallet);
router.get("/transactions", authMiddleware, WalletController.getTransactions);
router.patch("/settings", authMiddleware, WalletController.updateSettings);

export default router;

