import dotenv from "dotenv";
dotenv.config();

export const env = {
    port: process.env.PORT || 3001,
    useRateGainMock: process.env.USE_RATEGAIN_MOCK === "true",

    rateGain: {
        baseUrl: process.env.RATEGAIN_BASE_URL!,
        apiKey: process.env.RATEGAIN_API_KEY!,
        apiSecret: process.env.RATEGAIN_SECRET_KEY!,
    },
};
