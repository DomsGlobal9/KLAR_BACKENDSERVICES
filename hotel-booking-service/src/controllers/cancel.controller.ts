import { Request, Response } from "express";
import { cancelService } from "../services/cancel.service";

export const cancelController = async (req: Request, res: Response) => {
  try {
    console.log("🚫 Cancel Request Body:", JSON.stringify(req.body, null, 2));
    const data = await cancelService.cancel(req.body);
    res.json(data);
  } catch (error: any) {
    console.error(
      "Cancel Controller Error:",
      error.response?.data || error.message,
    );
    const rateGainError = error.response?.data;
    res.status(error.response?.status || 500).json({
      status: false,
      statusCode: error.response?.status || 500,
      description:
        rateGainError?.description || error.message || "Internal Server Error",
      body: rateGainError || null,
    });
  }
};

export const getCancelChargesController = async (
  req: Request,
  res: Response,
) => {
  try {
    console.log(
      "🔍 Get Cancel Charges Query:",
      JSON.stringify(req.query, null, 2),
    );
    const data = await cancelService.getCancelCharges(req.query);
    res.json(data);
  } catch (error: any) {
    console.error(
      "Get Cancel Charges Error:",
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({
      status: false,
      statusCode: error.response?.status || 500,
      description:
        error.response?.data?.description ||
        error.message ||
        "Internal Server Error",
      body: error.response?.data || null,
    });
  }
};
