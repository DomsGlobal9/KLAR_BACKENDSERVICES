import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  PORT: number;
  MONGO_URI: string;
//   CORS_ORIGIN: string;
}

const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || "5014", 10),

  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/visa-services",

//   CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
};

// ✅ Validate required variables
if (!env.MONGO_URI) {
  throw new Error("❌ MONGO_URI is not defined in .env");
}

export default env;