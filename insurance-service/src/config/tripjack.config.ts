import { env } from "./env";

type TripjackInsuranceConfig = {
    BASE_URL: string;
    API_KEY: string;
    ENV: "TEST" | "PROD";
};

const isProduction = process.env.NODE_ENV === "production";

const tripjackInsuranceConfig: TripjackInsuranceConfig = isProduction
    ? {
          BASE_URL: env.TRIPJACK_PROD.BASE_URL,
          API_KEY: env.TRIPJACK_PROD.API_KEY,
          ENV: "PROD",
      }
    : {
          BASE_URL: env.TRIPJACK_TEST.BASE_URL,
          API_KEY: env.TRIPJACK_TEST.API_KEY,
          ENV: "TEST",
      };

export default tripjackInsuranceConfig;