import { Request, Response, NextFunction } from "express";
import { TourQueryService } from "../services/tour.service";

export class TourQueryController {
  private tourQueryService: TourQueryService;

  constructor() {
    this.tourQueryService = new TourQueryService();
  }

  public createQuery = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.tourQueryService.submitQuery(req.body);

      return res.status(201).json({
        success: true,
        message: "Your travel query has been submitted successfully!",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}