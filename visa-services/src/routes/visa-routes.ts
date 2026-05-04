import express from "express";
import {
  applyVisa,
  getAllVisas,
  getVisaByType,
  getVisaById,
} from "../controllers/visa-controller";


import { applyVisaController } from "../controllers/visa-controller";

const router = express.Router();

// ✅ FINAL API
router.post("/apply", applyVisaController);


// GET
router.get("/all", getAllVisas);
router.get("/type/:type", getVisaByType);
router.get("/:id", getVisaById);


export default router;  