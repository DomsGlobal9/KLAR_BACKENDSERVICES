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

    email: string;
    loginType?: string;
    mobile: string;

    passwordHash?: string;

    roles: Roles[];

    loginType: LoginType;

    status: UserStatus;

    googleId?: string;

    googlePhoto?: string;


    /* B2B ONLY */

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
            trim: true,
        },

        passwordHash: {
            type: String,
        },


        /* =========================
           ROLES
        ========================= */

        roles: {
            type: [String],
            enum: Object.values(Roles),
            default: [Roles.USER],
        },


        /* =========================
           LOGIN
        ========================= */

        loginType: {
            type: String,
            enum: Object.values(LoginType),
            required: true,
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
   EXPORT
========================= */

export const UserModel = mongoose.model<IUser>(
    "User",
    UserSchema
);












// import mongoose, { Schema, Document } from "mongoose";
// import { ClientType } from "../constants/clientTypes";
// import { UserStatus } from "../constants/userStatus";
// import { Roles } from "../constants/roles";

// import { BusinessProfileSchema } from "./businessProfile.schema";
// import { VerificationSchema } from "./verification.schema";
// import { WalletSchema } from "./wallet.model";

// export interface IUser extends Document {
//     clientType: ClientType;
//     email: string;
//     mobile: string;
//     passwordHash: string;
//     roles: Roles[];
//     status: UserStatus;
//     blockReason?: string;
//     pendingReason?: string;
//     rejectedReason?: string;
//     businessProfile?: any;
//     verification?: any;
//     wallet?: any;
//     createdBy?: mongoose.Types.ObjectId;
//     createdAt: Date;
//     updatedAt: Date;
// }



// const UserSchema = new Schema<IUser>(
//     {
//         clientType: {
//             type: String,
//             enum: Object.values(ClientType),
//             required: true,
//         },

//         email: {
//             type: String,
//             required: true,
//             lowercase: true,
//             trim: true,
//         },

//         mobile: {
//             type: String,
//             required: true,
//         },

//         passwordHash: {
//             type: String,
//             required: true,
//         },

//         roles: {
//             type: [String],
//             enum: Object.values(Roles),
//             default: [Roles.USER],
//         },

//         status: {
//             type: String,
//             enum: Object.values(UserStatus),
//             default: UserStatus.REGISTERED,
//         },

//         blockReason: {
//             type: String,
//             trim: true,
//         },

//         pendingReason: {
//             type: String,
//             trim: true,
//         },

//         rejectedReason: {
//             type: String,
//             trim: true,
//         },

//         businessProfile: {
//             type: BusinessProfileSchema,
//         },

//         verification: {
//             type: VerificationSchema,
//         },
//         createdBy: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "User",
//         },
//     },
//     {
//         timestamps: true,
//     }
// );


// UserSchema.index(
//     { email: 1, clientType: 1 },
//     { unique: true }
// );


// export const UserModel = mongoose.model<IUser>("User", UserSchema);
