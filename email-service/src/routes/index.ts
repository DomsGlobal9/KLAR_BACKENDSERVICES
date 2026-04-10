import { Router } from "express";
import emailRoutes from "./email.routes";

const router = Router();

router.use("/email", emailRoutes);

export default router;