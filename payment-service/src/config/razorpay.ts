import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (!razorpayKeyId || !razorpayKeySecret) {
    console.error("CRITICAL: Razorpay Key ID and Secret are required in .env");
}

export const razorpayInstance = new Razorpay({
    key_id: razorpayKeyId || '',
    key_secret: razorpayKeySecret || ''
});
