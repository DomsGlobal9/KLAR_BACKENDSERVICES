import { env } from "./env";

export interface TripjackInsuranceUrls {
    TEST: {
        BASE_URL: string;
    };
    PROD: {
        BASE_URL: string;
    };
}

export const TRIPJACK_INSURANCE_URLS: TripjackInsuranceUrls = {
    TEST: {
        BASE_URL: env.TRIPJACK_TEST.BASE_URL,
    },
    PROD: {
        BASE_URL: env.TRIPJACK_PROD.BASE_URL,
    },
};