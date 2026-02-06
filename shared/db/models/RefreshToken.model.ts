import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRefreshToken extends Document {
    userId: mongoose.Types.ObjectId;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true
        },
        token: {
            type: String,
            required: [true, 'Token is required'],
            unique: true,
            index: true
        },
        expiresAt: {
            type: Date,
            required: [true, 'Expiration date is required']
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret: any) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

// TTL index - MongoDB will automatically delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient lookups
refreshTokenSchema.index({ userId: 1, token: 1 });

const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
    'RefreshToken',
    refreshTokenSchema
);

export default RefreshToken;
