import axios from "axios";
import { envConfig, getTripJackEndpoint } from "../config/env";
import { TripJackRawModel } from "../models/tripJackRaw.model";
import {
    InstantBookingRequest,
    InstantBookingResponse,
    DeliveryInfo,
    ContactInfo,
    GSTInfo,
    TravellerInfo,
    SSRInfo,
    PaxType,
    PaymentInfo,
    Title
} from "../interface/flight/booking.interface";

export class FlightInstantBookingService {

    /**
     * Create an instant booking (with payment)
     */
    static async createInstantBooking(
        payload: InstantBookingRequest
    ): Promise<InstantBookingResponse> {
        try {
            const url = getTripJackEndpoint('BOOKING_CREATE');

            console.log("🔍 Creating instant booking:", {
                url,
                bookingId: payload.bookingId,
                amount: payload.paymentInfos[0]?.amount,
                travellers: payload.travellerInfo.length
            });

            const response = await axios.post(
                url,
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: envConfig.TRIPJACK.API_KEY,
                    },
                    timeout: envConfig.TRIPJACK.TIMEOUT,
                }
            );

            await TripJackRawModel.create({
                provider: "TRIPJACK",
                endpoint: "BOOK_INSTANT",
                requestPayload: payload,
                responsePayload: response.data,
                searchKey: `booking:${payload.bookingId}`,
            }).catch((err) => {
                console.error("Failed to store TripJack raw data", err);
            });

            return response.data as InstantBookingResponse;
        } catch (error: any) {
            console.error("❌ TripJack Instant Booking Error:", {
                endpoint: getTripJackEndpoint('BOOKING_CREATE'),
                bookingId: payload.bookingId,
                error: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });
            throw error;
        }
    }

    /**
     * Validate booking request based on review response conditions
     */
    static validateBookingRequest(
        bookingRequest: InstantBookingRequest,
        reviewResponse: any
    ): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const conditions = reviewResponse.conditions || {};

        if (conditions.gst?.igm === true) {
            if (!bookingRequest.gstInfo) {
                errors.push("GST information is mandatory for this booking");
            } else {
                const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
                if (!gstRegex.test(bookingRequest.gstInfo.gstNumber)) {
                    errors.push("Invalid GST number format");
                }
                if (bookingRequest.gstInfo.registeredName.length > 35) {
                    errors.push("GST registered name must be max 35 characters");
                }
                if (bookingRequest.gstInfo.address && bookingRequest.gstInfo.address.length > 70) {
                    errors.push("GST address must be max 70 characters");
                }
            }
        }

        if (conditions.iecr === true) {
            if (!bookingRequest.contactInfo) {
                errors.push("Emergency contact information is mandatory");
            } else {
                if (!bookingRequest.contactInfo.ecn) {
                    errors.push("Emergency contact name is required");
                }
                if (!bookingRequest.contactInfo.emails?.length) {
                    errors.push("Emergency contact email is required");
                }
                if (!bookingRequest.contactInfo.contacts?.length) {
                    errors.push("Emergency contact phone is required");
                }
            }
        }


        if (conditions.dc?.idm === true) {
            bookingRequest.travellerInfo.forEach((traveller, index) => {
                if (!traveller.di) {
                    errors.push(`Document ID required for traveller ${index + 1}`);
                }
            });
        }


        if (conditions.pcs?.pm === true) {
            bookingRequest.travellerInfo.forEach((traveller, index) => {
                if (!traveller.pNum || !traveller.eD || !traveller.pNat) {
                    errors.push(`Passport details required for traveller ${index + 1}`);
                }
            });
        }


        bookingRequest.travellerInfo.forEach((traveller, index) => {
            const validTitles = {
                ADULT: ['Mr', 'Mrs', 'Ms'],
                CHILD: ['Ms', 'Master'],
                INFANT: ['Ms', 'Master']
            };

            if (!validTitles[traveller.pt]?.includes(traveller.ti)) {
                errors.push(`Invalid title '${traveller.ti}' for ${traveller.pt} traveller ${index + 1}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Create a basic booking request from lead/quote data
     */
    static createBookingRequestFromLead(
        bookingId: string,
        totalFare: number,
        lead: any,
        travellers: Array<{ firstName: string; lastName: string; type: PaxType; title: Title; dob?: string }>,
        ssrSelections?: {
            baggage?: Array<{ segmentId: string; code: string }>;
            meal?: Array<{ segmentId: string; code: string }>;
            seat?: Array<{ segmentId: string; code: string }>;
        }
    ): InstantBookingRequest {

        const paymentInfos: PaymentInfo[] = [{
            amount: totalFare
        }];

        const deliveryInfo: DeliveryInfo = {
            emails: [lead.email],
            contacts: [lead.phone]
        };

        const travellerInfo: TravellerInfo[] = travellers.map(t => ({
            ti: t.title,
            pt: t.type,
            fN: t.firstName,
            lN: t.lastName,
            dob: t.dob,
            ssrBaggageInfos: ssrSelections?.baggage?.map(b => ({
                key: b.segmentId,
                code: b.code
            })),
            ssrMealInfos: ssrSelections?.meal?.map(m => ({
                key: m.segmentId,
                code: m.code
            })),
            ssrSeatInfos: ssrSelections?.seat?.map(s => ({
                key: s.segmentId,
                code: s.code
            })),
        }));

        const bookingRequest: InstantBookingRequest = {
            bookingId,
            paymentInfos,
            deliveryInfo,
            travellerInfo
        };


        if (lead.gst_number) {
            bookingRequest.gstInfo = {
                gstNumber: lead.gst_number,
                registeredName: lead.company_name || lead.name,
                email: lead.email,
                mobile: lead.phone,
                address: lead.company_address
            };
        }


        bookingRequest.contactInfo = {
            emails: [lead.email],
            contacts: [lead.phone],
            ecn: lead.name
        };

        return bookingRequest;
    }
}