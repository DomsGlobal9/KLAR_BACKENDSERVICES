import axios from "axios";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import TripjackFieldMapper from "../utils/mappers/tripjackField.mapper";
import RedisCacheService from "../cache/redisCache.service";
import { v4 as uuidv4 } from "uuid";
import { FlightReviewDataService } from "./flightReviewData.service";
import { envConfig } from "../config";

export const SERVICE_TYPES = {
    FLIGHTS: "FLIGHTS",
    HOTELS: "hotel",
    BUS: "bus",
    TRAIN: "train",
    INSURANCE: "insurance"
} as const;

class ReviewService {

    private applyMarkupToFare(mappedData: any, markup: any): any {
        const finalData = JSON.parse(JSON.stringify(mappedData));
        const percentageMarkup = markup.services?.[0]?.percentageMarkup || 0;
        const fixedMarkup = markup.services?.[0]?.fixedMarkup || 0;

        if (percentageMarkup === 0 && fixedMarkup === 0) {
            return finalData;
        }

        const appliedTo = markup.appliedTo || 'BASE_FARE';

        if (finalData.TripInformation && Array.isArray(finalData.TripInformation)) {
            finalData.TripInformation = finalData.TripInformation.map((trip: any) => {
                if (trip.TotalPriceList && Array.isArray(trip.TotalPriceList)) {
                    trip.TotalPriceList = trip.TotalPriceList.map((priceItem: any) => {
                        if (priceItem.FareDetails?.AdultFare?.FareComponents) {
                            const fareComponents = priceItem.FareDetails.AdultFare.FareComponents;

                            if (fareComponents.AdditionalFareComponents?.TotalAdditionalFare) {
                                const taxComponents = fareComponents.AdditionalFareComponents.TotalAdditionalFare;

                                let taxAmount = 0;

                                if (appliedTo === 'BASE_FARE') {
                                    taxAmount = fareComponents.BaseFare || 0;
                                } else {
                                    taxAmount = fareComponents.TotalFare || fareComponents.NetFare || 0;
                                }

                                const markupAmount = (taxAmount * percentageMarkup / 100) + fixedMarkup;

                                if (taxComponents.CarrierMiscFee) {
                                    taxComponents.CarrierMiscFee += markupAmount;
                                } else {
                                    taxComponents.MarkupAmount = (taxComponents.MarkupAmount || 0) + markupAmount;
                                }

                                fareComponents.MarkupAmount = markupAmount;
                                fareComponents.TotalFare = (fareComponents.TotalFare || fareComponents.NetFare || 0) + markupAmount;
                                fareComponents.NetFare = (fareComponents.NetFare || 0) + markupAmount;

                                if (finalData.totalPriceInfo?.totalFareDetail?.FareComponents) {
                                    const totalFareComp = finalData.totalPriceInfo.totalFareDetail.FareComponents;
                                    totalFareComp.MarkupAmount = (totalFareComp.MarkupAmount || 0) + markupAmount;
                                    totalFareComp.TotalFare = (totalFareComp.TotalFare || 0) + markupAmount;
                                    totalFareComp.NetFare = (totalFareComp.NetFare || 0) + markupAmount;
                                }
                            }
                        }
                        return priceItem;
                    });
                }
                return trip;
            });
        }

        finalData.markupApplied = {
            percentage: percentageMarkup,
            fixed: fixedMarkup,
            appliedTo: appliedTo,
            markupId: markup._id
        };

        return finalData;
    }

    async reviewFare(priceIds: string[]) {
        const sessionId = uuidv4();
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.REVIEW}`;

        try {
            const response = await axios.post(
                url,
                { priceIds },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    }
                }
            );

            const rawData = response.data;
            const mappedData = TripjackFieldMapper.map(rawData);

            await RedisCacheService.set(sessionId, {
                raw: mappedData,
            }, 1800);

            const markupData = await this.getMarkupByServiceType(SERVICE_TYPES.FLIGHTS);

            let finalData = mappedData;
            if (markupData?.success && markupData?.data) {
                finalData = this.applyMarkupToFare(mappedData, markupData.data);
            }

            console.log("[FINAL FARE WITH MARKUP]", JSON.stringify({
                originalBaseFare: mappedData.TripInformation?.[0]?.TotalPriceList?.[0]?.FareDetails?.AdultFare?.FareComponents?.BaseFare,
                originalTaxes: mappedData.TripInformation?.[0]?.TotalPriceList?.[0]?.FareDetails?.AdultFare?.FareComponents?.AdditionalFareComponents?.TotalAdditionalFare,
                finalTotalFare: finalData.TripInformation?.[0]?.TotalPriceList?.[0]?.FareDetails?.AdultFare?.FareComponents?.TotalFare,
                markupApplied: finalData.markupApplied
            }, null, 2));

            await RedisCacheService.set(sessionId, {
                raw: finalData,
            }, 1800);

            return {
                mappedData: finalData,
                sessionId
            };

        } catch (error: any) {
            console.error("Review Fare ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            const tripjackError = error.response?.data;

            if (tripjackError && tripjackError.errors && tripjackError.errors.length > 0) {
                const firstError = tripjackError.errors[0];
                const customError = new Error(firstError.message);
                (customError as any).statusCode = error.response?.status || 400;
                (customError as any).errorCode = firstError.errCode;
                (customError as any).details = firstError.details;
                (customError as any).referenceId = firstError.id;
                throw customError;
            }

            throw error;
        }
    }

    async getMarkupByServiceType(serviceType: string) {
        try {


            const response = await axios.post(
                `${envConfig.AUTH_SERVICE}/markup/${serviceType}`,
                {
                    userId: process.env.USER_ID
                },
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );

            return response.data;
        } catch (error: any) {
            console.error("Get Markup API ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    async beforeBookVerify(bookingIds: string) {

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.FARE_VALIDATE}`;

        try {
            const response = await axios.post(
                url,
                { bookingIds },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    }
                }
            );

            const rawData = response.data;

            const mappedData = TripjackFieldMapper.map(rawData);

            return {
                mappedData
            };

        } catch (error: any) {
            console.error("Before Book Verify ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }
}

export default new ReviewService();