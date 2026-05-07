import { config } from './env.config';

const isProd = config.RAZORPAY_ENVIRONMENT === 'live';

export const razorpayConfig = {
    keyId: isProd
        ? config.RAZORPAY_PROD_KEY_ID
        : config.RAZORPAY_KEY_ID,

    keySecret: isProd
        ? config.RAZORPAY_PROD_KEY_SECRET
        : config.RAZORPAY_KEY_SECRET,

    environment: config.RAZORPAY_ENVIRONMENT || 'test',

    apiUrl: 'https://api.razorpay.com/v1',
};