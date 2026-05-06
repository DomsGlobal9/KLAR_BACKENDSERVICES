import { MarkupEarning } from '../models/markup-earning.model';
import { Types } from 'mongoose';

export class MarkupEarningRepository {

    async getMonthlyRevenue(userId: Types.ObjectId, startDate: Date) {
        return MarkupEarning.aggregate([
            {
                $match: {
                    userId,
                    type: 'MARKUP_EARNING',
                    status: 'SUCCESS',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalMarkup: { $sum: '$markupAmount' },
                    bookingCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            {
                $project: {
                    _id: 0,
                    month: {
                        $concat: [
                            { $toString: '$_id.year' },
                            '-',
                            { $cond: [{ $lt: ['$_id.month', 10] }, '0', ''] },
                            { $toString: '$_id.month' }
                        ]
                    },
                    totalMarkup: 1,
                    bookingCount: 1
                }
            }
        ]);
    }
}