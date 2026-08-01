import { Request, Response, NextFunction } from "express";
import { PassportService } from "../services/passport.service";

export class PassportController {
  private passportService: PassportService;

  constructor() {
    this.passportService = new PassportService();
  }

  createPassportQuote = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const quote = await this.passportService.requestQuote(req.body);

      return res.status(201).json({
        success: true,
        message: "Passport quote request submitted successfully",
        data: quote,
      });
    } catch (error) {
      next(error);
    }
  };
}