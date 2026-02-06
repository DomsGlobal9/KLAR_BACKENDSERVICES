import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";
import { authenticateJWT as authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Wallet Routes - All require authentication
router.get("/b2b/wallet", authMiddleware, WalletController.getWallet);
router.post("/b2b/wallet/credit", authMiddleware, WalletController.creditWallet);
router.post("/b2b/wallet/debit", authMiddleware, WalletController.debitWallet);
router.get("/b2b/wallet/transactions", authMiddleware, WalletController.getTransactions);
router.patch("/b2b/wallet/settings", authMiddleware, WalletController.updateSettings);

export default router;

