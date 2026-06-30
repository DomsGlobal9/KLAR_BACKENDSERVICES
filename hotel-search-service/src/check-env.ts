import * as dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

console.log("TRIPJACK_API_KEY:", process.env.TRIPJACK_API_KEY);
console.log("TRIPJACK_AGENCY_ID:", process.env.TRIPJACK_AGENCY_ID);
console.log("TRIPJACK_BASE_URL:", process.env.TRIPJACK_BASE_URL);
