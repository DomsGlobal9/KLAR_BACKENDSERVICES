import tripjackConfig from "../config/tripjack.config";
import { tripjackHttpClient } from "../utils/tripjackHttpClient";

import {
    GetAmendmentChargesRequest,
    AmendmentChargesResponse,
    SubmitAmendmentRequest,
    SubmitAmendmentResponse,
    AmendmentDetailsRequest,
    AmendmentDetailsResponse,
} from "../types/tripjackCancellation.types";
import { TRIPJACK_URLS } from "../config";

const urls = TRIPJACK_URLS[tripjackConfig.ENV];

export class TripjackCancellationService {
    /**
     * Step 1: Get cancellation charges
     */
    static async getAmendmentCharges(
        payload: GetAmendmentChargesRequest
    ): Promise<AmendmentChargesResponse> {
        return tripjackHttpClient.post<
            AmendmentChargesResponse,
            GetAmendmentChargesRequest
        >(urls.AMENDMENT_CHARGES, payload);
    }

    /**
     * Step 2: Submit cancellation
     */
    static async submitAmendment(
        payload: SubmitAmendmentRequest
    ): Promise<SubmitAmendmentResponse> {
        return tripjackHttpClient.post<
            SubmitAmendmentResponse,
            SubmitAmendmentRequest
        >(urls.SUBMIT_AMENDMENT, payload);
    }

    /**
     * Step 3: Get cancellation status
     */
    static async getAmendmentDetails(
        payload: AmendmentDetailsRequest
    ): Promise<AmendmentDetailsResponse> {
        return tripjackHttpClient.post<
            AmendmentDetailsResponse,
            AmendmentDetailsRequest
        >(urls.AMENDMENT_DETAILS, payload);
    }

    /**
     * Step 4: Poll status until completion
     */
    static async pollAmendmentStatus(
        amendmentId: string,
        retries = 5,
        delayMs = 10000
    ): Promise<AmendmentDetailsResponse> {
        for (let i = 0; i < retries; i++) {
            const response = await this.getAmendmentDetails({ amendmentId });

            if (response.amendmentStatus !== "REQUESTED") {
                return response;
            }

            await new Promise((res) => setTimeout(res, delayMs));
        }

        throw new Error("Amendment polling timeout");
    }
}