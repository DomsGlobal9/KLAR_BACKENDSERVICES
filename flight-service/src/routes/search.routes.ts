import { Router } from "express";
import { searchOneWayController } from "../controllers/search.controller";

const router = Router();

router.post("/oneway", searchOneWayController);

export default router;