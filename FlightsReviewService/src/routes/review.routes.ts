import { Router } from "express";
import { reviewController, revalidateController } from "../controllers/review.controller";

const router = Router();

/**
 * @swagger
 * /api/flights/review:
 *   post:
 *     summary: Review flight before booking
 *     description: Validates flight availability and pricing before proceeding to booking. Returns detailed flight information, pricing, and booking conditions.
 *     tags:
 *       - Flight Review
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewInput'
 *           example:
 *             searchId: "TJS107700007440"
 *             priceIds: ["TJS107700007440_DELBLRUK807_5962124616134657"]
 *     responses:
 *       200:
 *         description: Review successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReviewResult'
 *       400:
 *         description: Bad request - Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/review", reviewController);

/**
 * @swagger
 * /api/flights/revalidate:
 *   post:
 *     summary: Revalidate fare before final booking
 *     description: Revalidates the fare to ensure pricing hasn't changed since the initial review. Should be called immediately before final booking confirmation.
 *     tags:
 *       - Flight Review
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RevalidateInput'
 *           example:
 *             reviewId: "TJS107700007440"
 *     responses:
 *       200:
 *         description: Revalidation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RevalidateResult'
 *       400:
 *         description: Bad request - Invalid review ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/revalidate", revalidateController);

export default router;
