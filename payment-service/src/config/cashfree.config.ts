import { config } from './env.config';

const CASHFREE_URLS = {
    sandbox: 'https://sandbox.cashfree.com/pg',
    production: 'https://api.cashfree.com/pg',
} as const;

export const cashfreeConfig = {
    appId: config.CASHFREE_APP_ID,
    secretKey: config.CASHFREE_SECRET_KEY,
    environment: config.CASHFREE_ENVIRONMENT,
    apiUrl: CASHFREE_URLS[config.CASHFREE_ENVIRONMENT],
};