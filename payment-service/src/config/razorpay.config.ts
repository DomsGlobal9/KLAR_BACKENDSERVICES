import { config } from './env.config';

const isProd = config.RAZORPAY_ENVIRONMENT === 'live';

export const razorpayConfig = {
    keyId: isProd
        ? config.RAZORPAY_PROD_KEY_ID
        : config.RAZORPAY_KEY_ID,

    keySecret: isProd
        ? config.RAZORPAY_PROD_KEY_SECRET
        : config.RAZORPAY_KEY_SECRET,

    prodKeyId: config.RAZORPAY_PROD_KEY_ID,

    prodKeySecret: config.RAZORPAY_PROD_KEY_SECRET,

    testKeyId: config.RAZORPAY_KEY_ID,

    testKeySecret: config.RAZORPAY_KEY_SECRET,

    environment: config.RAZORPAY_ENVIRONMENT,

    webhookSecret: config.RAZORPAY_WEBHOOK_SECRET,

    apiUrl: 'https://api.razorpay.com/v1/payments',

    isProduction: isProd,
};

if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
    throw new Error('Razorpay credentials are not configured properly');
}

if (!razorpayConfig.webhookSecret && razorpayConfig.environment === 'live') {
    throw new Error('Razorpay webhook secret is required for production');
}