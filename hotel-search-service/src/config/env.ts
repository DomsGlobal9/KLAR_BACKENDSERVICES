import dotenv from "dotenv";
dotenv.config();

export const env = {
    port: process.env.PORT || 5012,
    jwtSecret: process.env.JWT_SECRET || "your_super_secret_jwt_key_change_me_in_production",

    rateGain: {
        baseUrl: process.env.RATEGAIN_BASE_URL!,
        apiKey: process.env.RATEGAIN_API_KEY!,
        apiSecret: process.env.RATEGAIN_SECRET_KEY!,
    },
};

if (!env.rateGain.baseUrl) {
    console.error("❌ RATEGAIN_BASE_URL is not set. Service will not work.");
}
if (!env.rateGain.apiKey) {
    console.error("❌ RATEGAIN_API_KEY is not set. Service will not work.");
}
