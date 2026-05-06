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

    async pullService(
        userId: Types.ObjectId,
        serviceType: string
    ): Promise<IMarkup | null> {
        return Markup.findOneAndUpdate(
            { userId },
            {
                $pull: { services: { serviceType } },
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