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
    mobile: string;
    passwordHash: string;
    roles: Roles[];
    status: UserStatus;

    businessProfile?: any;
    verification?: any;
    wallet?: any;

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

        businessProfile: {
            type: BusinessProfileSchema,
        },

        verification: {
            type: VerificationSchema,
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
