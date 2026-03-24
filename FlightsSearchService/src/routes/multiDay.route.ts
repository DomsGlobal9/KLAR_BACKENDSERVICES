import express from 'express';
import { searchFlightsForWeek } from "../controllers/multiDaySearch.controller";

const router = express.Router();


router.post("/search/week", searchFlightsForWeek);

export default router;