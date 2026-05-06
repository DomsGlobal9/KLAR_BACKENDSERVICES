import { config } from './env.config';

export const razorpayConfig = {
    keyId: config.RAZORPAY_KEY_ID,
    keySecret: config.RAZORPAY_KEY_SECRET,
    environment: config.RAZORPAY_ENVIRONMENT || 'test',
    apiUrl: config.RAZORPAY_ENVIRONMENT === 'live' 
        ? 'https://api.razorpay.com/v1' 
        : 'https://api.razorpay.com/v1', 
};