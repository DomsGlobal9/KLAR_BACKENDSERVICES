import { Request, Response } from "express";
import { PriceAlertModel } from "../model/PriceAlert.model";

export class PriceAlertController {
  public static async createOrUpdateAlert(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        userEmail,
        origin,
        originCity,
        destination,
        destinationCity,
        travelDate,
        currentFare,
        targetPrice,
        directFlightsOnly,
        cabinClass,
      } = req.body;

      if (!origin || !destination || !travelDate || !targetPrice) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: origin, destination, travelDate, targetPrice",
        });
        return;
      }

      const alert = await PriceAlertModel.findOneAndUpdate(
        {
          origin: origin.toUpperCase(),
          destination: destination.toUpperCase(),
          travelDate,
          ...(userEmail ? { userEmail } : {}),
        },
        {
          userId,
          userEmail,
          origin: origin.toUpperCase(),
          originCity: originCity || origin,
          destination: destination.toUpperCase(),
          destinationCity: destinationCity || destination,
          travelDate,
          currentFare: currentFare || 0,
          targetPrice,
          directFlightsOnly: !!directFlightsOnly,
          cabinClass: cabinClass || "Economy",
          status: "ACTIVE",
        },
        { upsert: true, new: true }
      );

      res.status(200).json({
        success: true,
        message: "Price alert saved successfully",
        data: alert,
      });
    } catch (error: any) {
      console.error("❌ [PriceAlertController] Error saving alert:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error saving price alert",
        error: error.message,
      });
    }
  }

  public static async getUserAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { userEmail, userId } = req.query;
      const filter: any = { status: "ACTIVE" };

      if (userEmail) filter.userEmail = userEmail;
      if (userId) filter.userId = userId;

      const alerts = await PriceAlertModel.find(filter).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error: any) {
      console.error("❌ [PriceAlertController] Error fetching alerts:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error fetching price alerts",
        error: error.message,
      });
    }
  }

  public static async deleteAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await PriceAlertModel.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Price alert deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ [PriceAlertController] Error deleting alert:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error deleting price alert",
        error: error.message,
      });
    }
  }
}
