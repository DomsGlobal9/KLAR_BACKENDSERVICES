import { Request, Response, NextFunction } from 'express';
import { MarkupService } from '../services/markup.service';
import { MarkupEarning } from '../models/markup-earning.model';
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";
import { Types } from 'mongoose';



export class MarkupController {

  static async addMarkup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const markupData = req.body;

    const data = await MarkupService.upsert(
      new Types.ObjectId(req.user.userId),
      markupData
    );

    res.status(201).json({
      success: true,
      message: "Markup added successfully",
      data
    });
  } catch (error) {
    next(error);
  }
  }

  static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {

     if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            
    const data = await MarkupService.getAll(new Types.ObjectId(req.user.userId));
    res.json({ success: true, data });
  }

  static async bulkUpdate(req: AuthenticatedRequest, res: Response, next: NextFunction) {

     if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

    const { markups } = req.body;
    await MarkupService.bulkUpsert(new Types.ObjectId(req.user.userId), markups);
    res.json({ success: true, message: 'Markups updated successfully' });
  }

  static async deleteOne(req: AuthenticatedRequest, res: Response, next: NextFunction) {
     if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
    await MarkupService.delete(new Types.ObjectId(req.user.userId), req.params.serviceType as string);
    res.json({ success: true });
  }

  static async getMonthlyRevenue(req: AuthenticatedRequest, res: Response) {
     if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
    const { monthsBack = 12 } = req.query;
    const data = await MarkupService.getMonthlyMarkupRevenue(new Types.ObjectId(req.user.userId), Number(monthsBack));
    res.json({ success: true, data });
  }
}