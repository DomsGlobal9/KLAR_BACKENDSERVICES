
import { Router } from "express";
import {
    getFareRulesById,
    getBatchFareRules,
    parseRtf
} from "../controllers/fareRuleController";

const router = Router();

router.post("/", getFareRulesById);

router.post("/batch", getBatchFareRules);

router.post("/parse-rtf", parseRtf);

export default router;