import { Markup } from '../models/markup.model';
import { MarkupEarning } from '../models/markup-earning.model';
import { Types } from 'mongoose';

export class MarkupService {
  // === CRUD ===
  static async getAll(userId: Types.ObjectId, serviceType?: string) {
    const markup = await Markup.findOne({ userId, isActive: true });
    if (!markup) return [];
    if (serviceType) {
      return markup.services.filter(s => s.serviceType === serviceType);
    }
    return markup.services;
  }

  static async getByServiceType(userId: Types.ObjectId, serviceType: string) {
    const markup = await Markup.findOne({ userId, isActive: true });
    if (!markup) return null;
    return markup.services.find(s => s.serviceType === serviceType) || null;
  }

  static async upsert(userId: Types.ObjectId, data: any) {
    // Determine if data contains the full services array or a single service object.
    const markup = await Markup.findOne({ userId });
    
    if (data.services && Array.isArray(data.services)) {
      // Upserting the entire array
      return Markup.findOneAndUpdate(
        { userId },
        { ...data, userId, updatedBy: userId },
        { upsert: true, new: true, runValidators: true }
      );
    } else if (data.serviceType) {
      // Upserting a single service object into the array
      if (!markup) {
        return Markup.create({
          userId,
          services: [data],
          updatedBy: userId,
          createdBy: userId
        });
      }

      const existingServiceIndex = markup.services.findIndex(s => s.serviceType === data.serviceType);
      
      if (existingServiceIndex > -1) {
        markup.services[existingServiceIndex].percentageMarkup = data.percentageMarkup || 0;
        markup.services[existingServiceIndex].fixedMarkup = data.fixedMarkup || 0;
      } else {
        markup.services.push(data);
      }
      
      // Update by userId to trigger mongoose middleware for the rule
      return markup.save();
    }
    
    throw new Error('Invalid markup data provided.');
  }

  static async bulkUpsert(userId: Types.ObjectId, markups: any[]) {
    // Ensure all services conform to the target format
    let markup = await Markup.findOne({ userId });

    if (!markup) {
      return Markup.create({
        userId,
        services: markups,
        updatedBy: userId,
        createdBy: userId
      });
    }

    // Merge new markups into existing ones
    markups.forEach((m: any) => {
      const idx = markup!.services.findIndex(s => s.serviceType === m.serviceType);
      if (idx > -1) {
        markup!.services[idx].percentageMarkup = m.percentageMarkup || 0;
        markup!.services[idx].fixedMarkup = m.fixedMarkup || 0;
      } else {
        markup!.services.push(m);
      }
    });

    return markup.save();
  }

  static async delete(userId: Types.ObjectId, serviceType: string) {
    return Markup.findOneAndUpdate(
      { userId },
      { $pull: { services: { serviceType } }, updatedBy: userId },
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