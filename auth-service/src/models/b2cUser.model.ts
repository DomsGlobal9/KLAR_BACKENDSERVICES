import mongoose, { Schema, Document } from "mongoose";

export enum B2CRoles {
    USER = "user",
    ADMIN = "admin",
}

export enum B2CLoginType {
    EMAIL = "email",
    MOBILE = "mobile",
    GOOGLE = "google",
}

export enum B2CUserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    BLOCKED = "BLOCKED",
}

export interface IB2CUser extends Document {
    fullName: string;
    email: string;
    password: string;
    mobileNumber: string;
    role: B2CRoles;
    googleId?: string;
    googlePhoto?: string;
    loginType: B2CLoginType;
    status: B2CUserStatus;
    createdAt: Date;
    updatedAt: Date;
}

const B2CUserSchema = new Schema<IB2CUser>(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: false,
        },
        mobileNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        role: {
            type: String,
            enum: Object.values(B2CRoles),
            default: B2CRoles.USER,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        googlePhoto: {
            type: String,
        },
        loginType: {
            type: String,
            enum: Object.values(B2CLoginType),
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(B2CUserStatus),
            default: B2CUserStatus.ACTIVE,
        },
    },
    {
        timestamps: true,
    }
);

B2CUserSchema.index({ email: 1 });
B2CUserSchema.index({ mobileNumber: 1 });

export const B2CUserModel = mongoose.model<IB2CUser>("B2CUser", B2CUserSchema);