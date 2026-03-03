import { Request, Response } from "express";
import { reviewService } from "../services/review.service";

/**
 * Review flight controller
 * POST /api/flights/review
 */
export async function reviewController(req: Request, res: Response) {
  try {
    const result = await reviewService.review(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error("Review error:", err);
    res.status(400).json({
      success: false,
      message: err.message || "Failed to review flight"
    });
  }
}

/**
 * Revalidate fare controller
 * POST /api/flights/revalidate
 */
export async function revalidateController(req: Request, res: Response) {
  try {
    const { reviewId } = req.body;

    if (!reviewId) {
      res.status(400).json({
        success: false,
        message: "reviewId is required"
      });
      return;
    }

    const result = await reviewService.revalidate({ reviewId });

    // Return appropriate status code based on fare validity
    const statusCode = result.fareValid ? 200 : 409; // 409 Conflict if fare changed

    res.status(statusCode).json({
      success: result.success,
      data: result
    });
  } catch (err: any) {
    console.error("Revalidate error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to revalidate fare"
    });
  }
}
