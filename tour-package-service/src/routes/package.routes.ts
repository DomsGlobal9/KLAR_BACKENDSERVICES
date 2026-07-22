import { Router } from "express";

const router = Router();

// Define package endpoints
router.get("/search", (_req, res) => {
  res.json({ success: true, message: "Search packages endpoint" });
});

router.get("/:id", (_req, res) => {
  res.json({ success: true, message: "Get package details endpoint" });
});

export default router;