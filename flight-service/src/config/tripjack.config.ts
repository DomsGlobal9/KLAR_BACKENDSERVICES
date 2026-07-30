import { envConfig } from "./env.config";

type TripjackConfig = {
  BASE_URL: string;
  API_KEY: string;
  ENV: "TEST" | "PROD";
};

//const isProduction = envConfig.NODE_ENV === "production";

const isProduction = envConfig.NODE_ENV === "production" || process.env.USE_LIVE_API === "true" || process.env.TRIPJACK_ENV === "PROD";

const tripjackConfig: TripjackConfig = isProduction
  ? {
      BASE_URL: envConfig.TRIPJACK_PROD.BASE_URL,
      API_KEY: envConfig.TRIPJACK_PROD.API_KEY,
      ENV: "PROD",
    }
  : {
      BASE_URL: envConfig.TRIPJACK_TEST.BASE_URL,
      API_KEY: envConfig.TRIPJACK_TEST.API_KEY,
      ENV: "TEST",
    };

export default tripjackConfig;