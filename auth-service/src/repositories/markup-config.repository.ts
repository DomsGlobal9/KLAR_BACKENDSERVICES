import { Types } from "mongoose";

import {
    MarkupConfig,
    IMarkupConfig,
    MarkupRegion,
    MarkupScope,
} from "../models/markup-config.model";

export class MarkupConfigRepository {

    async findAll(): Promise<IMarkupConfig[]> {
        return MarkupConfig.find()
            .sort({ scope: 1, serviceType: 1, region: 1 })
            .lean();
    }

    /** Callers must pass an already-canonicalised serviceType and region
     *  (see canonicalServiceType / canonicalRegion in markup-config.service). */
    async findOne(
        scope: MarkupScope,
        serviceType: string,
        region: MarkupRegion
    ): Promise<IMarkupConfig | null> {
        return MarkupConfig.findOne({
            scope,
            serviceType: serviceType.toUpperCase(),
            region,
        }).lean();
    }

    async upsert(
        scope: MarkupScope,
        serviceType: string,
        region: MarkupRegion,
        data: Pick<IMarkupConfig, "type" | "value" | "enabled">,
        masterId: Types.ObjectId
    ): Promise<IMarkupConfig | null> {
        return MarkupConfig.findOneAndUpdate(
            { scope, serviceType: serviceType.toUpperCase(), region },
            {
                $set: {
                    type: data.type,
                    value: data.value,
                    enabled: data.enabled,
                    updatedBy: masterId,
                },
                // region is part of the filter, so upsert seeds it on insert.
                $setOnInsert: { createdBy: masterId },
            },
            { upsert: true, new: true, runValidators: true }
        ).lean();
    }

    async delete(
        scope: MarkupScope,
        serviceType: string,
        region: MarkupRegion
    ): Promise<boolean> {
        const result = await MarkupConfig.deleteOne({
            scope,
            serviceType: serviceType.toUpperCase(),
            region,
        });
        return result.deletedCount > 0;
    }
}
