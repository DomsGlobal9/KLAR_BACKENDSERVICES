import { Markup, IMarkup } from '../models/markup.model';
import { Types } from 'mongoose';

export class MarkupRepository {

    async findActiveByUser(userId: Types.ObjectId): Promise<IMarkup | null> {
        return Markup.findOne({ userId, isActive: true }).lean();
    }

    async findByUser(userId: Types.ObjectId): Promise<IMarkup | null> {
        return Markup.findOne({ userId });
    }

    async upsertFull(
        userId: Types.ObjectId,
        updateData: Partial<IMarkup>
    ): Promise<IMarkup | null> {
        return Markup.findOneAndUpdate(
            { userId },
            updateData,
            { upsert: true, new: true, runValidators: true }
        );
    }

    async updateServices(
        userId: Types.ObjectId,
        services: IMarkup['services'],
        appliedTo?: IMarkup['appliedTo']
    ): Promise<IMarkup | null> {
        const update: any = {
            services,
            updatedBy: userId
        };

        if (appliedTo) update.appliedTo = appliedTo;

        return Markup.findOneAndUpdate(
            { userId },
            { $set: update },
            { upsert: true, new: true, runValidators: true }
        );
    }

    async save(document: IMarkup): Promise<IMarkup> {
        return document.save();
    }

    async create(data: Partial<IMarkup>): Promise<IMarkup> {
        return Markup.create(data);
    }

    /**
     * Removes the one (serviceType, region) rule.
     *
     * The region predicate matters: pulling on serviceType alone would delete
     * an agent's DOMESTIC *and* INTERNATIONAL margins when they asked to remove
     * one of them.
     *
     * `$in: [region, null]` covers rows written before the region field existed
     * and not yet touched by the migration — for region "ALL" those are the
     * same rule.
     */
    async pullService(
        userId: Types.ObjectId,
        serviceType: string,
        region: string = 'ALL'
    ): Promise<IMarkup | null> {
        const regionMatch =
            region === 'ALL' ? { $in: [region, null] } : region;

        return Markup.findOneAndUpdate(
            { userId },
            {
                $pull: { services: { serviceType, region: regionMatch } },
                $set: { updatedBy: userId }
            },
            { new: true }
        );
    }

    async pullServiceById(
        userId: Types.ObjectId,
        serviceId: Types.ObjectId
    ): Promise<IMarkup | null> {

        return Markup.findOneAndUpdate(
            { userId },
            {
                $pull: { services: { _id: serviceId } },
                $set: { updatedBy: userId }
            },
            { new: true }
        );
    }
}