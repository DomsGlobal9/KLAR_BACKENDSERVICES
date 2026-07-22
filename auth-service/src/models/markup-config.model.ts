import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Platform-wide markup configuration, owned exclusively by the KLAR master.
 *
 * Deliberately NOT part of the per-user `Markup` collection: that one is keyed
 * by a unique `userId` and means "this agent's own margin". These rows belong
 * to no user — they are singletons per (scope, serviceType) — and mixing them
 * in would let any /markup write path reach platform pricing.
 *
 * Two scopes, which stack rather than compete:
 *
 *   PLATFORM — a hidden margin folded into the supplier net BEFORE anyone
 *              sees it. Agents perceive the result as "the api price" and
 *              cannot decompose it. Applies to every channel.
 *
 *   B2C      — an ADDITIONAL margin applied only to B2C traffic, on top of
 *              the platform-marked-up net. It is B2C's analogue of the margin
 *              a B2B agent sets for themselves.
 *
 * Worked example (HOTEL, PLATFORM=+100 fixed, agent=+100 fixed):
 *   supplier net 300 --(+platform 100)--> api net 400 (what the agent sees)
 *                    --(+agent 100)-----> 500 (what the agent's customer pays)
 * The agent never learns that 100 of "their" 400 base is ours; their customer
 * never learns about the agent's 100.
 */

export type MarkupScope = "PLATFORM" | "B2C";
export type MarkupValueType = "FIXED" | "PERCENTAGE";

export interface IMarkupConfig extends Document {
    scope: MarkupScope;
    serviceType: string;
    type: MarkupValueType;
    value: number;
    enabled: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const MarkupConfigSchema = new Schema<IMarkupConfig>(
    {
        scope: {
            type: String,
            enum: ["PLATFORM", "B2C"],
            required: true,
        },

        serviceType: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },

        type: {
            type: String,
            enum: ["FIXED", "PERCENTAGE"],
            required: true,
            default: "FIXED",
        },

        // A percentage above 100 is far more likely to be a fixed-amount typo
        // than an intended 3x sell price, and the resulting overcharge is
        // invisible to the agent who would otherwise catch it. Bound both
        // variants at the schema so no write path can bypass the check.
        value: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        enabled: {
            type: Boolean,
            default: false,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

/** One config per (scope, serviceType) — this is what makes the row a singleton. */
MarkupConfigSchema.index({ scope: 1, serviceType: 1 }, { unique: true });

function assertValueInRange(this: any, type: MarkupValueType, value: number) {
    if (type === "PERCENTAGE" && value > 100) {
        throw new Error(
            `Percentage markup ${value}% exceeds the 100% ceiling. If you meant a flat amount, set type=FIXED.`
        );
    }
}

MarkupConfigSchema.pre("save", function (this: IMarkupConfig, next: any) {
    assertValueInRange.call(this, this.type, this.value);
    next();
});

MarkupConfigSchema.pre("findOneAndUpdate", function (this: any) {
    const update = this.getUpdate() || {};
    const doc = update.$set || update;

    if (doc.type !== undefined && doc.value !== undefined) {
        assertValueInRange.call(this, doc.type, doc.value);
    }
});

export const MarkupConfig = mongoose.model<IMarkupConfig>(
    "MarkupConfig",
    MarkupConfigSchema
);
