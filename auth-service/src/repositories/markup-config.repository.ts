import { Types } from "mongoose";

import {
    MarkupConfig,
    IMarkupConfig,
    MarkupScope,
} from "../models/markup-config.model";

export class MarkupConfigRepository {

    async findAll(): Promise<IMarkupConfig[]> {
        return MarkupConfig.find().sort({ scope: 1, serviceType: 1 }).lean();
    }

    /** Callers must pass an already-canonicalised serviceType
     *  (see canonicalServiceType in markup-config.service). */
    async findOne(
        scope: MarkupScope,
        serviceType: string
    ): Promise<IMarkupConfig | null> {
        return MarkupConfig.findOne({
            scope,
            serviceType: serviceType.toUpperCase(),
        }).lean();
    }

    async upsert(
        scope: MarkupScope,
        serviceType: string,
        data: Pick<IMarkupConfig, "type" | "value" | "enabled">,
        masterId: Types.ObjectId
    ): Promise<IMarkupConfig | null> {
        return MarkupConfig.findOneAndUpdate(
            { scope, serviceType: serviceType.toUpperCase() },
            {
                $set: {
                    type: data.type,
                    value: data.value,
                    enabled: data.enabled,
                    updatedBy: masterId,
                },
                $setOnInsert: { createdBy: masterId },
            },
            { upsert: true, new: true, runValidators: true }
        ).lean();
    }

    async delete(
        scope: MarkupScope,
        serviceType: string
    ): Promise<boolean> {
        const result = await MarkupConfig.deleteOne({
            scope,
            serviceType: serviceType.toUpperCase(),
        });
        return result.deletedCount > 0;
    }
}
