import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { BookingRequest } from "../models/tripjack.types";
import { env } from "../config/env";
import { CabBookingModel, CabBookingStatus } from "../models/CabBooking.model";
import { getCityFromAddress, getCountryFromAddress } from "../utils/location.utils";

class BookingService {
    private getAgentDetail() {
        return {
            agentId: Number(env.tripJack.agencyId) || 312879,
            agentEmail: "support@klar.com",
            agentPhone: "+911234567890"
        };
    }

    async book(payload: any) {
        if (!payload.journeyInfo || !payload.passengerDetail) {
            throw { status: 400, message: "Missing journeyInfo or passengerDetail" };
        }

        // quoteId / vehicleType live inside quotationInfo per TripJack doc
        if (!payload.quotationInfo?.quoteId && !payload.quotationInfo?.childQuoteId) {
            throw { status: 400, message: "quotationInfo.quoteId (or childQuoteId) is required for booking" };
        }

        const agent = this.getAgentDetail();

        const routeDetail = {
            ...payload.routeDetail,
            origin: {
                ...payload.routeDetail?.origin,
                type: "location",
                address: payload.routeDetail?.origin?.address || {
                    city: getCityFromAddress(payload.routeDetail?.origin?.displayAddress),
                    country: getCountryFromAddress(payload.routeDetail?.origin?.displayAddress)
                }
            },
            destination: {
                ...payload.routeDetail?.destination,
                type: "location",
                address: payload.routeDetail?.destination?.address || {
                    city: getCityFromAddress(payload.routeDetail?.destination?.displayAddress),
                    country: getCountryFromAddress(payload.routeDetail?.destination?.displayAddress)
                }
            }
        };

        const finalPayload: BookingRequest = {
            ...payload,
            routeDetail,
            agentId: Number(payload.agentId || agent.agentId),
            agentEmail: String(payload.agentEmail || agent.agentEmail),
            agentPhone: String(payload.agentPhone || agent.agentPhone),
            consent: String(payload.consent || "yes"),
            vendorId: Number(payload.vendorId || payload.quotationInfo?.vendorId)
        };

        console.log("[BookingService] Final Payload to TripJack:", JSON.stringify(finalPayload, null, 2));

        const response = await tripJackCabsProvider.createBooking(finalPayload);

        const bookingId = response?.data?.id || response?.data?.bookingId;

        // PERSISTENCE: Save to MongoDB
        if (bookingId) {
            try {
                const opt = payload.quotationInfo;
                const pricing = payload.pricingInfo;

                await CabBookingModel.create({
                    bookingId,
                    correlationId: finalPayload.correlationId,
                    userId: payload.userId || "guest", // Save userId from payload
                    status: CabBookingStatus.CONFIRMED,
                    pickupDate: new Date(payload.journeyInfo.pickupDateTime || payload.journeyInfo.pickupDate),
                    origin: {
                        displayAddress: payload.routeDetail?.origin?.displayAddress || payload.routeDetail?.source?.displayAddress || "Unknown",
                        lat: String(payload.routeDetail?.origin?.lat || payload.routeDetail?.source?.lat || "0"),
                        long: String(payload.routeDetail?.origin?.long || payload.routeDetail?.source?.long || "0")
                    },
                    destination: {
                        displayAddress: payload.routeDetail?.destination?.displayAddress || "Unknown",
                        lat: String(payload.routeDetail?.destination?.lat || "0"),
                        long: String(payload.routeDetail?.destination?.long || "0")
                    },
                    vehicleType: opt?.vehicleType || "Unknown",
                    vehicleCategory: opt?.vehicleCategory || "Unknown",
                    totalAmount: pricing?.grossAmount || 0,
                    currency: pricing?.currency || "INR",
                    passenger: {
                        firstName: payload.passengerDetail.firstName,
                        lastName: payload.passengerDetail.lastName,
                        email: payload.passengerDetail.email,
                        phone: payload.passengerDetail.phone
                    },
                    tripJackRequest: finalPayload,
                    tripJackResponse: response
                });
                console.log(`✅ [BookingService] Saved booking ${bookingId} to DB.`);
            } catch (dbError) {
                console.error("❌ [BookingService] Failed to save booking to DB:", dbError);
                // We don't throw here to avoid failing a successful TripJack booking
            }
        }

        return response;
    }

}

export const bookingService = new BookingService();
