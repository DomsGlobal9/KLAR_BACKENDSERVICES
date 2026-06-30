// Trigger reload
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

export const env = {
    port: process.env.PORT,
    tripJack: {
        apiKey: process.env.TRIPJACK_API_KEY || "",
        agencyId: process.env.TRIPJACK_AGENCY_ID || "",
        baseUrl: process.env.TRIPJACK_BASE_URL || "https://apitest-cabs.tripjack.com",
    },
    mongoUri: process.env.MONGODB_URI || "",
    jwtSecret: process.env.JWT_SECRET || "your_super_secret_jwt_key_change_me_in_production",
    authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:5010",
};
