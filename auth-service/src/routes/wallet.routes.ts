import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";
import { authenticateJWT as authMiddleware } from "../middlewares/authentication.middleware";

const router = Router();

/**
 * Wallet Routes - All require authentication
 */
router.get("/", authMiddleware, WalletController.getWallet);
router.get("/transactions", authMiddleware, WalletController.getTransactions);
router.post("/credit", authMiddleware, WalletController.creditWallet);
router.post("/debit", authMiddleware, WalletController.debitWallet);
router.post("/pay", authMiddleware, WalletController.debitWallet);
router.patch("/settings", authMiddleware, WalletController.updateSettings);
router.get("/:source", WalletController.getWalletb2c);

export default router;