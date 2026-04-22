import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { BookingRequest, EmbeddedBookingRequest } from "../models/tripjack.types";
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
            agentId:    Number(payload.agentId    || agent.agentId),
            agentEmail: String(payload.agentEmail || agent.agentEmail),
            agentPhone: String(payload.agentPhone || agent.agentPhone),
            consent:    String(payload.consent    || "yes"),
            vendorId:   Number(payload.vendorId   || payload.quotationInfo?.vendorId)
        };

        console.log("[BookingService] Final Payload to TripJack:", JSON.stringify(finalPayload, null, 2));

        const response = await tripJackCabsProvider.createBooking(finalPayload);

        // PERSISTENCE: Save to MongoDB
        if (response?.data?.bookingId) {
            try {
                const opt = payload.quotationInfo;
                const pricing = payload.pricingInfo;
                
                await CabBookingModel.create({
                    bookingId: response.data.bookingId,
                    correlationId: finalPayload.correlationId,
                    status: CabBookingStatus.CONFIRMED,
                    pickupDate: new Date(payload.journeyInfo.pickupDate),
                    origin: {
                        displayAddress: payload.routeDetail?.origin?.displayAddress || payload.routeDetail?.source?.displayAddress || "Unknown",
                        lat: payload.routeDetail?.origin?.lat || payload.routeDetail?.source?.lat,
                        long: payload.routeDetail?.origin?.long || payload.routeDetail?.source?.long
                    },
                    destination: {
                        displayAddress: payload.routeDetail?.destination?.displayAddress || "Unknown",
                        lat: payload.routeDetail?.destination?.lat,
                        long: payload.routeDetail?.destination?.long
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
                console.log(`✅ [BookingService] Saved booking ${response.data.bookingId} to DB.`);
            } catch (dbError) {
                console.error("❌ [BookingService] Failed to save booking to DB:", dbError);
                // We don't throw here to avoid failing a successful TripJack booking
            }
        }

        return response;
    }

    async embeddedBook(payload: EmbeddedBookingRequest) {
        if (!payload.sourceBookingId || !payload.bookingRequestList || !payload.bookingRequestList.length) {
            throw { status: 400, message: "Missing sourceBookingId or bookingRequestList" };
        }

        const agent = this.getAgentDetail();

        // Inject mandatory fields for each booking request in the list
        const processedList = payload.bookingRequestList.map(req => ({
            ...req,
            agentId:    req.agentId    || agent.agentId,
            agentEmail: req.agentEmail || agent.agentEmail,
            agentPhone: req.agentPhone || agent.agentPhone,
            consent:    req.consent    || "yes",
            vendorId:   req.vendorId   || req.quotationInfo?.vendorId
        }));

        const finalPayload: EmbeddedBookingRequest = {
            ...payload,
            bookingRequestList: processedList
        };

        return await tripJackCabsProvider.createEmbeddedBooking(finalPayload);
    }
}

export const bookingService = new BookingService();
