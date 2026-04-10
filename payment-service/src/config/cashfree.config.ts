import { config } from './env.config';

export const cashfreeConfig = {
    appId: config.CASHFREE_APP_ID,
    secretKey: config.CASHFREE_SECRET_KEY,
    environment: config.CASHFREE_ENVIRONMENT,
    apiUrl: config.CASHFREE_ENVIRONMENT === 'production' 
        ? 'https://api.cashfree.com' 
        : 'https://sandbox.cashfree.com',
};

export const getCashfreeAuthToken = (): string => {
    return Buffer.from(`${cashfreeConfig.appId}:${cashfreeConfig.secretKey}`).toString('base64');
};


export const cashfreeClient = {
    config: cashfreeConfig,
    getAuthToken: getCashfreeAuthToken,
    getApiUrl: () => cashfreeConfig.apiUrl,
};

console.log(`✅ Cashfree configured for ${config.CASHFREE_ENVIRONMENT} environment`);