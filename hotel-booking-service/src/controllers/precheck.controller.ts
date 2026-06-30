import { Request, Response } from "express";
import { precheckService } from "../services/precheck.service";

export const precheckController = async (req: Request, res: Response) => {
  try {
    const data = await precheckService.precheck(req.body);
    res.json(data);
  } catch (error: any) {
    console.error(
      "Precheck Controller Error:",
      error.response?.data || error.message,
    );

    const errorData = error.response?.data || error.data;
    const errorMessage =
      errorData?.errors?.[0]?.message ||
      errorData?.error?.message ||
      errorData?.description ||
      error.message ||
      "Internal Server Error";

    res.status(error.response?.status || error.status || 500).json({
      status: false,
      statusCode: error.response?.status || error.status || 500,
      description: errorMessage,
      body: errorData || null,
    });
  }
};
