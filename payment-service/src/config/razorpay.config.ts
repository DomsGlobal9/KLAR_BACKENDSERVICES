import { config } from './env.config';

const isProd = config.RAZORPAY_ENVIRONMENT === 'live';

export const razorpayConfig = {
    b2b: {
        keyId: isProd
            ? config.RAZORPAY_B2B_PROD_KEY_ID
            : config.RAZORPAY_B2B_TEST_KEY_ID,
        keySecret: isProd
            ? config.RAZORPAY_B2B_PROD_KEY_SECRET
            : config.RAZORPAY_B2B_TEST_KEY_SECRET,
        testKeyId: config.RAZORPAY_B2B_TEST_KEY_ID,
        testKeySecret: config.RAZORPAY_B2B_TEST_KEY_SECRET,
        prodKeyId: config.RAZORPAY_B2B_PROD_KEY_ID,
        prodKeySecret: config.RAZORPAY_B2B_PROD_KEY_SECRET,
    },
    b2c: {
        keyId: isProd
            ? config.RAZORPAY_B2C_PROD_KEY_ID
            : config.RAZORPAY_B2C_TEST_KEY_ID,
        keySecret: isProd
            ? config.RAZORPAY_B2C_PROD_KEY_SECRET
            : config.RAZORPAY_B2C_TEST_KEY_SECRET,
        testKeyId: config.RAZORPAY_B2C_TEST_KEY_ID,
        testKeySecret: config.RAZORPAY_B2C_TEST_KEY_SECRET,
        prodKeyId: config.RAZORPAY_B2C_PROD_KEY_ID,
        prodKeySecret: config.RAZORPAY_B2C_PROD_KEY_SECRET,
    },
    environment: config.RAZORPAY_ENVIRONMENT,
    webhookSecret: config.RAZORPAY_WEBHOOK_SECRET,
    apiUrl: config.RAZORPAY_API_URL,
    isProduction: isProd,
};

if (!razorpayConfig.b2b.keyId || !razorpayConfig.b2b.keySecret) {
    throw new Error('Razorpay B2B credentials are not configured properly');
}

if (!razorpayConfig.b2c.keyId || !razorpayConfig.b2c.keySecret) {
    throw new Error('Razorpay B2C credentials are not configured properly');
}

if (!razorpayConfig.webhookSecret && razorpayConfig.environment === 'live') {
    throw new Error('Razorpay webhook secret is required for production');
}