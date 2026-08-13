import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Trusted context captured from a successful TripSafe Review, so that Book can
 * verify the client is booking what was actually reviewed (B1).
 *
 * Doc v6.0 p. 23: "All submitted data must exactly match the information
 * provided in the Insurance Review Request." /review and /book are independent
 * stateless requests, so without this the reviewed plan, traveller set and fare
 * are known only to the client.
 *
 * Written best-effort — a failure here never fails the Review. Read fail-open —
 * Book proceeds unchanged when no context exists, so in-flight reviews at
 * deploy time and anything past the TTL behave exactly as before.
 */

export interface IReviewTraveller {
    id?: number;
    age?: number;
    dob?: string;
}

export interface IInsuranceReviewContext extends Document {
    bid: string;
    plid?: string;
    pid?: string;
    travellerCount: number;
    travellers: IReviewTraveller[];
    sd?: Date;
    ed?: Date;
    /** Reviewed total fare. Null when it could not be located in the response. */
    reviewedAmount?: number | null;
    createdAt?: Date;
}

const reviewTravellerSchema = new Schema<IReviewTraveller>(
    { id: Number, age: Number, dob: String },
    { _id: false }
);

const insuranceReviewContextSchema = new Schema<IInsuranceReviewContext>({
    bid:            { type: String, required: true, unique: true },
    plid:           { type: String },
    pid:            { type: String },
    travellerCount: { type: Number, default: 0 },
    travellers:     { type: [reviewTravellerSchema], default: [] },
    sd:             { type: Date },
    ed:             { type: Date },
    reviewedAmount: { type: Number, default: null },

    // TTL — review context is only useful until the booking is made. Upstream
    // states reviewed plans do not currently expire, so 24h is a safe ceiling.
    createdAt:      { type: Date, default: Date.now, expires: 86_400 },
});

export const InsuranceReviewContextModel: Model<IInsuranceReviewContext> =
    mongoose.models.InsuranceReviewContext ||
    mongoose.model<IInsuranceReviewContext>("InsuranceReviewContext", insuranceReviewContextSchema);
