import mongoose, { Schema, Document, Model } from 'mongoose';
const bcrypt = require('bcrypt');

export enum UserRole {
    CUSTOMER = 'customer',
    AGENT = 'agent',
    ADMIN = 'admin'
}

export interface IUser extends Document {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    fullName: string;
}

const userSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email address'
            ]
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false // Don't return password by default
        },
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true
        },
        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.CUSTOMER
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret: any) {
                delete ret.password;
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function (this: IUser, next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Create index
// userSchema.index({ email: 1 }); // Already indexed by unique: true definition

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;
