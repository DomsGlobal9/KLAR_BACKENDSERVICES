import { OTPModel, OTPType } from "../models/otp.model";
import { otpEmailTemplate } from "../templates/otp.template";
import { OTPUtil } from "../utils/otp.util";
import { EmailService } from "./email.service";

export class OTPService {
    
    /**
     * Generate and store OTP
     */
    public static async generateOTP(
        email: string,
        type: OTPType
    ) {
        const otp = OTPUtil.generateOTP();

        /**
         * Remove old OTPs
         */
        await OTPModel.deleteMany({
            email,
            type,
        });

        /**
         * Save new OTP
         */
        const otpDoc = await OTPModel.create({
            email,
            otp,
            type,

            expiresAt: new Date(
                Date.now() + 5 * 60 * 1000
            ),
        });

        /**
         * Send Email
         */
        await EmailService.sendEmail({
            to: email,
            subject: "Your OTP Verification Code",
            html: otpEmailTemplate(otp),
        });

        return otpDoc;
    }

    /**
     * Verify OTP
     */
    public static async verifyOTP(
        email: string,
        otp: string,
        type: OTPType
    ) {
        const existingOTP = await OTPModel.findOne({
            email,
            otp,
            type,
            verified: false,
        });

        if (!existingOTP) {
            throw new Error("Invalid OTP");
        }

        if (existingOTP.expiresAt < new Date()) {
            throw new Error("OTP expired");
        }

        existingOTP.verified = true;

        await existingOTP.save();

        return true;
    }

}