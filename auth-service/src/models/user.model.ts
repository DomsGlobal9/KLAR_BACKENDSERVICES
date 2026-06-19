import mongoose, { Schema, Document } from "mongoose";

import { ClientType } from "../constants/clientTypes";
import { UserStatus } from "../constants/userStatus";
import { Roles } from "../constants/roles";

import { BusinessProfileSchema } from "./businessProfile.schema";
import { VerificationSchema } from "./verification.schema";
import { WalletSchema } from "./wallet.model";



/* =========================
   LOGIN TYPES
========================= */

export enum LoginType {
    EMAIL = "email",
    MOBILE = "mobile",
    GOOGLE = "google",
}



/* =========================
   USER INTERFACE
========================= */

export interface IUser extends Document {

    /* COMMON */
    clientType: ClientType;
    fullName?: string;
    memberName?: string;
    email: string;
    mobile: string;
    passwordHash?: string;
    roles: Roles;
    loginType: LoginType;
    status: UserStatus;
    googleId?: string;
    googlePhoto?: string;

    /* B2B ONLY */
    blockReason?: string;
    pendingReason?: string;
    rejectedReason?: string;
    businessProfile?: any;
    verification?: any;
    wallet?: any;
    limit?: Number;
    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;

    /* TIMESTAMPS */
    createdAt: Date;
    updatedAt: Date;
}



/* =========================
   USER SCHEMA
========================= */

const UserSchema = new Schema<IUser>(
    {

        clientType: {
            type: String,
            enum: Object.values(ClientType),
            required: true,
        },


        /* =========================
           BASIC INFO
        ========================= */

        fullName: {
            type: String,
            trim: true,
        },

        memberName: {
            type: String,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            unique: true,
        },

        mobile: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        passwordHash: {
            type: String,
        },


        /* =========================
           ROLES
        ========================= */

        roles: {
            type: String,
            enum: Object.values(Roles),
            default: Roles.USER,
        },


        /* =========================
           LOGIN
        ========================= */

        loginType: {
            type: String,
            enum: Object.values(LoginType),
            required: true,
            default: LoginType.EMAIL,
        },

        googleId: {
            type: String,
            sparse: true,
            unique: true,
        },

        googlePhoto: {
            type: String,
        },


        /* =========================
           STATUS
        ========================= */

        status: {
            type: String,
            enum: Object.values(UserStatus),
            default: UserStatus.ACTIVE,
        },

        /* =========================
           LIMIT
        ========================= */        
        limit: {
            type: Number
        },

        /* =========================
           ADMIN / MODERATION
        ========================= */

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


        /* =========================
           B2B SECTIONS
        ========================= */

        businessProfile: {
            type: BusinessProfileSchema,
        },

        verification: {
            type: VerificationSchema,
        },

        resetPasswordToken: {
            type: String,
            sparse: true,
        },

        resetPasswordExpires: {
            type: Date,
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



/* =========================
   INDEXES
========================= */

UserSchema.index(
    { email: 1, clientType: 1 },
    { unique: true }
);

UserSchema.index(
    { mobile: 1, clientType: 1 },
    { unique: true }
);

UserSchema.index(
    { googleId: 1 },
    {
        unique: true,
        sparse: true,
    }
);



/* =========================
   VIRTUAL: Get display name (prefers memberName, then fullName, then email)
========================= */

UserSchema.virtual('displayName').get(function (this: IUser) {
    return this.memberName || this.fullName || this.email.split('@')[0];
});



/* =========================
   EXPORT
========================= */

export const UserModel = mongoose.model<IUser>(
    "User",
    UserSchema
);