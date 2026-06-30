import { Request, Response } from "express";
import { specialRequestsService } from "../services/special-requests.service";

export const specialRequestsController = async (
  _req: Request,
  res: Response,
) => {
  try {
    const data = await specialRequestsService.getSpecialRequests();
    res.json(data);
  } catch (error: any) {
    const errorData = error.response?.data;
    const errorMessage =
      typeof errorData === "string"
        ? errorData.substring(0, 500)
        : JSON.stringify(errorData || {}).substring(0, 500);

    console.warn(
      "⚠️ SpecialRequests Provider Unavailable:",
      errorMessage || error.message,
    );

    // Return empty body instead of 500 to keep frontend happy
    res.status(200).json({
      status: true,
      statusCode: 200,
      description: "Special requests temporarily unavailable",
      body: [],
    });
  }
};
