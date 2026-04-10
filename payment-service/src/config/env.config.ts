interface EnvConfig {
    // Server
    PORT: number;
    NODE_ENV: string;
    
    // Razorpay
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
    
    // Cashfree
    CASHFREE_APP_ID: string;
    CASHFREE_SECRET_KEY: string;
    CASHFREE_ENVIRONMENT: 'sandbox' | 'production';
}


const requiredEnvVars = [
    'PORT',
    'NODE_ENV',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'CASHFREE_APP_ID',
    'CASHFREE_SECRET_KEY',
    'CASHFREE_ENVIRONMENT',
] as const;


function validateEnv(): EnvConfig {
    const missingVars: string[] = [];
    
    
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missingVars.push(envVar);
        }
    }
    
    
    if (missingVars.length > 0) {
        throw new Error(
            `\nEnvironment configuration error:\n` +
            `Missing required environment variables:\n` +
            missingVars.map(v => `   - ${v}`).join('\n') +
            `\n\nPlease add these variables to your .env file.\n`
        );
    }
    
    
    const cashfreeEnv = process.env.CASHFREE_ENVIRONMENT as string;
    if (cashfreeEnv !== 'sandbox' && cashfreeEnv !== 'production') {
        throw new Error(
            `\nEnvironment configuration error:\n` +
            `CASHFREE_ENVIRONMENT must be either 'sandbox' or 'production', got: '${cashfreeEnv}'\n`
        );
    }
    
    
    const port = parseInt(process.env.PORT!);
    if (isNaN(port)) {
        throw new Error(
            `\nEnvironment configuration error:\n` +
            `PORT must be a number, got: '${process.env.PORT}'\n`
        );
    }
    
    
    const validNodeEnv = ['development', 'production', 'test'];
    if (!validNodeEnv.includes(process.env.NODE_ENV!)) {
        throw new Error(
            `\nEnvironment configuration error:\n` +
            `NODE_ENV must be one of: ${validNodeEnv.join(', ')}, got: '${process.env.NODE_ENV}'\n`
        );
    }
    
    
    return {
        PORT: port,
        NODE_ENV: process.env.NODE_ENV!,
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID!,
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,
        CASHFREE_APP_ID: process.env.CASHFREE_APP_ID!,
        CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY!,
        CASHFREE_ENVIRONMENT: cashfreeEnv as 'sandbox' | 'production'
    };
}


export const config = validateEnv();


