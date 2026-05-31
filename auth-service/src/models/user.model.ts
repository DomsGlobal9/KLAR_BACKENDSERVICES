import mongoose, { Schema, Document } from "mongoose";
import { ClientType } from "../constants/clientTypes";
import { UserStatus } from "../constants/userStatus";
import { Roles } from "../constants/roles";

import { BusinessProfileSchema } from "./businessProfile.schema";
import { VerificationSchema } from "./verification.schema";
import { WalletSchema } from "./wallet.model";

export interface IUser extends Document {
    clientType: ClientType;
    email: string;
    loginType?: string;
    mobile: string;
    passwordHash: string;
    roles: Roles[];
    status: UserStatus;
    blockReason?: string;
    pendingReason?: string;
    rejectedReason?: string;

    memberName?: string;
    businessProfile?: any;
    verification?: any;
    wallet?: any;

    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}



const UserSchema = new Schema<IUser>(
    {
        clientType: {
            type: String,
            enum: Object.values(ClientType),
            required: true,
        },

        memberName: {
            type: String,
            required: false,
        },

        loginType: {
            type: String,
            required: false,
            default: 'EMAIL',
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        mobile: {
            type: String,
            required: true,
        },

        passwordHash: {
            type: String,
            required: true,
        },

        roles: {
            type: [String],
            enum: Object.values(Roles),
            default: [Roles.USER],
        },

        status: {
            type: String,
            enum: Object.values(UserStatus),
            default: UserStatus.REGISTERED,
        },

        blockReason: {
            type: String,
            trim: true,
        },

        pendingReason: {
            type: String,
            trim: true,
        },

        rejectedReason: {
            type: String,
            trim: true,
        },

        businessProfile: {
            type: BusinessProfileSchema,
        },

        verification: {
            type: VerificationSchema,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);


UserSchema.index(
    { email: 1, clientType: 1 },
    { unique: true }
);


export const UserModel = mongoose.model<IUser>("User", UserSchema);
