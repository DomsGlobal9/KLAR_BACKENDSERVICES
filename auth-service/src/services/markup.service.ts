import { Markup } from '../models/markup.model';
import { MarkupEarning } from '../models/markup-earning.model';
import { Types } from 'mongoose';

export class MarkupService {
  // === CRUD ===
  static async getAll(userId: Types.ObjectId) {
    return Markup.find({ userId, isActive: true }).sort({ serviceType: 1 });
  }

  static async getByServiceType(userId: Types.ObjectId, serviceType: string) {
    return Markup.findOne({ userId, serviceType, isActive: true });
  }

  static async upsert(userId: Types.ObjectId, data: any) {
    return Markup.findOneAndUpdate(
      { userId, serviceType: data.serviceType },
      { ...data, userId, updatedBy: userId },
      { upsert: true, new: true, runValidators: true }
    );
  }

  static async bulkUpsert(userId: Types.ObjectId, markups: any[]) {
    const operations = markups.map(m => ({
      updateOne: {
        filter: { userId, serviceType: m.serviceType },
        update: { ...m, userId, updatedBy: userId },
        upsert: true,
      },
    }));
    return Markup.bulkWrite(operations);
  }

  static async delete(userId: Types.ObjectId, serviceType: string) {
    return Markup.findOneAndUpdate(
      { userId, serviceType },
      { isActive: false, updatedBy: userId },
      { new: true }
    );
  }

  // === Monthly Revenue (Markup Profit) ===
  static async getMonthlyMarkupRevenue(userId: Types.ObjectId, monthsBack = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const result = await MarkupEarning.aggregate([
      {
        $match: {
          userId,
          type: 'MARKUP_EARNING',
          status: 'SUCCESS',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalMarkup: { $sum: '$amount' },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $cond: { if: { $lt: ['$_id.month', 10] }, then: '0', else: '' } },
              { $toString: '$_id.month' },
            ],
          },
          totalMarkup: 1,
          bookingCount: 1,
        },
      },
    ]);

    return result;
  }
}