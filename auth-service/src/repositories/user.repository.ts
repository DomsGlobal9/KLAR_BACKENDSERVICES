import { UserModel, IUser, LoginType } from "../models/user.model";
import { Roles } from "../constants/roles";
import { UserStatus } from "../constants/userStatus";
import { ClientType } from "../constants/clientTypes";
import { Types } from 'mongoose';

export class UserRepository {

    private static instance: UserRepository;

    private constructor() { }

    static getInstance(): UserRepository {
        if (!UserRepository.instance) {
            UserRepository.instance = new UserRepository();
        }

        return UserRepository.instance;
    }

    async findUserById(userId: Types.ObjectId) {
        if (!userId) return null;

        return await UserModel.findOne({
            _id: userId,
        });
    }


    async createUser(userData: {
        clientType: ClientType;
        fullName?: string;
        email: string;
        mobile: string;
        passwordHash?: string;
        loginType: LoginType;
        roles?: Roles[];
        googleId?: string;
        googlePhoto?: string;
    }): Promise<IUser> {

        const user = new UserModel({
            clientType: userData.clientType,
            fullName: userData.fullName,
            email: userData.email.toLowerCase(),
            mobile: userData.mobile,
            passwordHash: userData.passwordHash,
            loginType: userData.loginType,
            roles: userData.roles || [Roles.USER],
            googleId: userData.googleId,
            googlePhoto: userData.googlePhoto,
            status: UserStatus.ACTIVE,
        });

        return await user.save();
    }


    async findByEmail(email: string): Promise<IUser | null> {
        return await UserModel.findOne({
            email: email.toLowerCase(),
        });
    }


    async findByMobile(mobile: string): Promise<IUser | null> {
        return await UserModel.findOne({ mobile });
    }


    async findById(userId: string): Promise<IUser | null> {
        return await UserModel.findById(userId);
    }


    async findByGoogleId(googleId: string): Promise<IUser | null> {
        return await UserModel.findOne({ googleId });
    }


    async isEmailExists(email: string): Promise<boolean> {
        const user = await UserModel.findOne({
            email: email.toLowerCase(),
        });

        return !!user;
    }


    async isMobileExists(mobile: string): Promise<boolean> {
        const user = await UserModel.findOne({ mobile });

        return !!user;
    }


    async updateUser(
        userId: string,
        updateData: Partial<IUser>
    ): Promise<IUser | null> {

        return await UserModel.findByIdAndUpdate(
            userId,
            {
                $set: updateData,
            },
            {
                new: true,
                runValidators: true,
            }
        );
    }


    async updatePassword(
        userId: string,
        passwordHash: string
    ): Promise<boolean> {

        const result = await UserModel.findByIdAndUpdate(
            userId,
            {
                passwordHash,
            }
        );

        return !!result;
    }

    async getUserBusinessDetails(userId: string): Promise<Partial<IUser> | null> {
        const user = await UserModel.findOne({
            _id: userId,
            roles: Roles.B2B_ADMIN,
        }).select({
            businessProfile: 1,
            clientType: 1,
            roles: 1,
            status: 1
        });

        return user;
    }

}

export default UserRepository;