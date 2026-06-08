import { Router } from "express";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import walletRoutes from "./wallet.routes";
import markupRoutes from "./markup.routes";
import dashboardRoutes from "./dashboard.routes";
import bookingRoutes from "./bookingPayment.routes";
import { Wallet } from "../models/wallet.model";
import { UserModel } from "../models/user.model";
import rmRoutes from "./rm.routes";
import companyRoutes from "./company.routes";
import b2cAuthRoutes from "./b2cAuth.routes";

const router = Router();


router.get("/health", (_req, res) => {
    res.json({ status: "OK" });
});

// ============================================================
// TEMP DEBUG ROUTE — Remove after fixing wallet balance issue
// ============================================================

/** GET /user/debug/wallets  — List all wallets and their users */
router.get("/debug/wallets", async (_req, res) => {
    try {
        const wallets = await Wallet.find({}).sort({ balance: -1 }).lean();
        const result = [];
        for (const w of wallets) {
            const user = await UserModel.findById((w as any).userId).lean();
            result.push({
                walletId: w._id,
                userId: (w as any).userId,
                email: (user as any)?.email || "USER_NOT_FOUND",
                balance: (w as any).balance,
                status: (w as any).status,
                currency: (w as any).currency,
            });
        }
        res.json({ success: true, total: result.length, wallets: result });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /user/debug/fix-wallet
 * Body: { targetEmail: "user@email.com", newBalance: 600000 }
 * Directly sets the balance for a user identified by email.
 */
router.post("/debug/fix-wallet", async (req, res) => {
    try {
        const { targetEmail, newBalance } = req.body;
        if (!targetEmail || newBalance === undefined) {
            return res.status(400).json({ success: false, message: "targetEmail and newBalance are required" });
        }
        const user = await UserModel.findOne({ email: targetEmail.toLowerCase() }).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: `User not found: ${targetEmail}` });
        }
        const wallet = await Wallet.findOne({ userId: (user as any)._id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: `Wallet not found for user: ${targetEmail}` });
        }
        const oldBalance = (wallet as any).balance;
        (wallet as any).balance = Number(newBalance);
        await wallet.save();
        res.json({
            success: true,
            message: `Balance updated for ${targetEmail}`,
            oldBalance,
            newBalance: (wallet as any).balance,
            walletId: wallet._id,
            userId: (user as any)._id,
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================

router.use("/rm", rmRoutes);
router.use("/auth", authRoutes);
router.use("/book", bookingRoutes);
router.use("/wallet", walletRoutes);
router.use("/markup", markupRoutes);
router.use("/company", companyRoutes);
router.use("/auth/b2c", b2cAuthRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/admin/verifications", adminRoutes);


export default router;
