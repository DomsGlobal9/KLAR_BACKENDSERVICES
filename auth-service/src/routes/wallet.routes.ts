import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";
import { authenticateJWT as authMiddleware } from "../middlewares/authentication.middleware";
import { internalServiceAuth } from "../middlewares/internalService.middleware";

const router = Router();

/**
 * Service-to-service credit. Takes an explicit userId in the body so background
 * jobs can refund the agent who owns a booking rather than the token holder.
 * Shared-secret guarded — never expose this to the browser.
 */
router.post("/internal/credit", internalServiceAuth, WalletController.internalCreditWallet);

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