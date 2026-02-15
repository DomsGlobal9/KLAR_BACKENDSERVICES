import { Router } from "express";
import { 
  getPriceReview, 
  getBatchPriceReview,
  getPriceReviewWithRules 
} from "../controllers/reviewController";

const router = Router();

/**
 * @route   POST /api/flights/review
 * @desc    Get price review for selected flight options
 * @access  Public
 * @body    { priceIds: string[] }
 * @returns { success: boolean, message: string, data: TransformedReviewPrice }
 */
router.post("/", getPriceReview);

/**
 * @route   POST /api/flights/review/batch
 * @desc    Get price reviews for multiple sets of price IDs
 * @access  Public
 * @body    { requests: Array<{ priceIds: string[] }> }
 * @returns { success: boolean, message: string, data: { successful: TransformedReviewPrice[], failed: ReviewError[], summary: { total: number, successful: number, failed: number } } }
 */
router.post("/batch", getBatchPriceReview);

/**
 * @route   POST /api/flights/review-with-rules
 * @desc    Get price review with fare rules included
 * @access  Public
 * @body    { priceIds: string[] }
 * @returns { success: boolean, message: string, data: TransformedReviewPrice & { fareRules?: any } }
 */
router.post("/review-with-rules", getPriceReviewWithRules);

export default router;