import { Markup } from '../models/markup.model';
import { MarkupEarning } from '../models/markup-earning.model';
import { Types } from 'mongoose';

export class MarkupService {

    // ==================== CRUD Operations ====================

    /** Get all markups for a user */
    static async getAll(userId: Types.ObjectId) {
        return await Markup.findOne({ 
            userId, 
            isActive: true 
        }).lean();
    }

    /** Get single service markup by type */
    static async getByServiceType(userId: Types.ObjectId, serviceType: string) {
        const markup = await Markup.findOne({ userId, isActive: true }).lean();
        return markup?.services.find(s => s.serviceType === serviceType) || null;
    }

    /** Upsert - Add or Update Markup (Single or Full) */
    static async upsert(userId: Types.ObjectId, data: any) {
        try {
            if (data.services && Array.isArray(data.services)) {
                // Full services array update
                const updateData: any = {
                    userId,
                    services: data.services,
                    updatedBy: userId
                };

                if (data.appliedTo) updateData.appliedTo = data.appliedTo;
                if (data.isActive !== undefined) updateData.isActive = data.isActive;

                return await Markup.findOneAndUpdate(
                    { userId },
                    updateData,
                    { upsert: true, new: true, runValidators: true }
                );
            } 
            else if (data.serviceType) {
                // Single service upsert
                let markup = await Markup.findOne({ userId });

                if (markup) {
                    const index = markup.services.findIndex(
                        s => s.serviceType === data.serviceType
                    );

                    if (index > -1) {
                        markup.services[index] = { ...markup.services[index], ...data };
                    } else {
                        markup.services.push(data);
                    }

                    markup.updatedBy = userId;
                    if (data.appliedTo) markup.appliedTo = data.appliedTo;

                    return await markup.save();
                } else {
                    // Create new document
                    return await Markup.create({
                        userId,
                        services: [data],
                        appliedTo: data.appliedTo || 'BASE_FARE',
                        createdBy: userId,
                        updatedBy: userId
                    });
                }
            }

            throw new Error('Invalid data: Either "services" array or "serviceType" is required');
        } catch (error: any) {
            console.error('MarkupService.upsert Error:', error.message);
            throw error;
        }
    }

    /** Bulk Upsert Markups */
    static async bulkUpsert(userId: Types.ObjectId, data: any) {
        try {
            const markups = Array.isArray(data) ? data : data.markups || [];
            const appliedTo = data.appliedTo;

            if (!Array.isArray(markups)) {
                throw new Error('Markups must be an array');
            }

            const updateData: any = {
                services: markups,
                updatedBy: userId
            };

            if (appliedTo) updateData.appliedTo = appliedTo;

            return await Markup.findOneAndUpdate(
                { userId },
                { $set: updateData },
                { upsert: true, new: true, runValidators: true }
            );
        } catch (error: any) {
            console.error('MarkupService.bulkUpsert Error:', error.message);
            throw error;
        }
    }

    /** Delete single service type markup */
    static async delete(userId: Types.ObjectId, serviceType: string) {
        if (!serviceType) throw new Error('serviceType is required');

        return await Markup.findOneAndUpdate(
            { userId },
            { 
                $pull: { services: { serviceType } },
                $set: { updatedBy: userId }
            },
            { new: true }
        );
    }

    // ==================== Revenue ====================

    /** Get Monthly Markup Revenue */
    static async getMonthlyMarkupRevenue(userId: Types.ObjectId, monthsBack: number = 12) {
        try {
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - monthsBack);

            const result = await MarkupEarning.aggregate([
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
                        totalMarkup: { $sum: '$amount' },
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

            return result;
        } catch (error: any) {
            console.error('MarkupService.getMonthlyMarkupRevenue Error:', error.message);
            throw error;
        }
    }
}