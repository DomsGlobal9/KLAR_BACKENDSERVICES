import { Request, Response, NextFunction } from "express";
import { CharterService } from "../services/charter.service";

export class CharterController {
  private charterService: CharterService;

  constructor() {
    this.charterService = new CharterService();
  }

  createCharterQuote = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.charterService.createCharterBooking(req.body);

      return res.status(201).json({
        success: true,
        message: "Charter request submitted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}