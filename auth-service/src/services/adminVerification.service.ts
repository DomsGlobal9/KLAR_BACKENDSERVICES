import { UserModel } from "../models/user.model";
import { VerificationStatus } from "../constants/verificationStatus";
import { UserStatus } from "../constants/userStatus";

export const getPendingVerificationsService = async () => {
    return UserModel.find({
        "verification.status": VerificationStatus.PENDING,
    }).select("-passwordHash");
};

export const approveVerificationService = async (userId: string) => {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw new Error("User not found");
    }

    user.verification!.status = VerificationStatus.APPROVED;
    user.verification!.verifiedAt = new Date();

    user.status = UserStatus.ACTIVE;

    await user.save();
};

export const rejectVerificationService = async (
    userId: string,
    remarks: string
) => {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw new Error("User not found");
    }

    user.verification!.status = VerificationStatus.REJECTED;
    user.verification!.remarks = remarks;
    user.status = UserStatus.REJECTED;

    await user.save();
};
