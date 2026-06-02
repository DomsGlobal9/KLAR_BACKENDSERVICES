import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { BookingRequest } from "../models/tripjack.types";
import { env } from "../config/env";
import { CabBookingModel, CabBookingStatus } from "../models/CabBooking.model";
import { getCityFromAddress, getCountryFromAddress } from "../utils/location.utils";
import { WalletUtil } from "../utils/wallet.util";

class BookingService {
    private getAgentDetail(payload: any) {
        return {
            agentId: Number(payload.agentId || env.tripJack.agencyId || 312879),
            agentEmail: String(payload.agentEmail || payload.passengerDetail?.email || "support@klar.com"),
            agentPhone: String(payload.agentPhone || payload.passengerDetail?.phone || "+911234567890")
        };
    }

    async book(payload: any, token?: string, user?: any) {
        if (!token) throw { status: 401, message: "Authentication token is required for booking" };

        if (!payload.journeyInfo || !payload.passengerDetail) {
            throw { status: 400, message: "Missing journeyInfo or passengerDetail" };
        }

        // quoteId / vehicleType live inside quotationInfo per TripJack doc
        if (!payload.quotationInfo?.quoteId && !payload.quotationInfo?.childQuoteId) {
            throw { status: 400, message: "quotationInfo.quoteId (or childQuoteId) is required for booking" };
        }

        const agent = this.getAgentDetail(payload);

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

        const pricingInfo = {
            netAmount: String(payload.pricingInfo?.netAmount || "0.00"),
            addonsPrice: String(payload.pricingInfo?.addonsPrice || "0.00"),
            tjTaxAmount: String(payload.pricingInfo?.tjTaxAmount || "0.00"),
            tjManagementFee: String(payload.pricingInfo?.tjManagementFee || "0.00"),
            agentMarkup: Number(payload.pricingInfo?.agentMarkup || 0),
            agentMarkupSplitup: {
                onwardJourneyMarkup: Number(payload.pricingInfo?.agentMarkupSplitup?.onwardJourneyMarkup || 0),
                returnJourneyMarkup: Number(payload.pricingInfo?.agentMarkupSplitup?.returnJourneyMarkup || 0)
            },
            grossAmount: String(payload.pricingInfo?.grossAmount || payload.pricingInfo?.netAmount || "0.00")
        };

        const quotationInfo = {
            vehicleType: String(payload.quotationInfo?.vehicleType || "Sedan"),
            vehicleCategory: String(payload.quotationInfo?.vehicleCategory || "Standard"),
            quoteId: String(payload.quotationInfo?.quoteId || payload.quotationInfo?.childQuoteId || ""),
            childQuoteId: String(payload.quotationInfo?.childQuoteId || payload.quotationInfo?.quoteId || ""),
            paxCount: Number(payload.quotationInfo?.paxCount || 1),
            luggageCount: Number(payload.quotationInfo?.luggageCount || 2),
            vendorId: Number(payload.quotationInfo?.vendorId || payload.vendorId || 1)
        };

        const passengerDetail = {
            firstName: String(payload.passengerDetail?.firstName || "Traveler"),
            lastName: String(payload.passengerDetail?.lastName || "Name"),
            email: String(payload.passengerDetail?.email || "mh@tj.com"),
            phone: String(payload.passengerDetail?.phone || "+919890809809"),
            ...(payload.passengerDetail?.flightDetails ? { flightDetails: payload.passengerDetail.flightDetails } : {})
        };

        const journeyInfo = {
            ...payload.journeyInfo,
            distance: String(payload.journeyInfo?.distance || "10 Km"),
            duration: Number(payload.journeyInfo?.duration || 30)
        };

        const finalPayload: BookingRequest = {
            ...payload,
            journeyInfo,
            routeDetail,
            quotationInfo,
            pricingInfo,
            passengerDetail,
            addons: Array.isArray(payload.addons) ? payload.addons : [],
            serviceRequest: String(payload.serviceRequest || ""),
            agentId: Number(payload.agentId || agent.agentId),
            agentEmail: String(payload.agentEmail || agent.agentEmail),
            agentPhone: String(payload.agentPhone || agent.agentPhone),
            consent: String(payload.consent || "yes"),
            vendorId: Number(payload.vendorId || quotationInfo.vendorId)
        };

        console.log("[BookingService] Final Payload to TripJack:", JSON.stringify(finalPayload, null, 2));

        const amount = Number(payload.pricingInfo?.grossAmount || 0);
        
        // Deduct from Klar Wallet BEFORE TripJack booking
        if (amount > 0) {
            const { hasBalance } = await WalletUtil.checkInternalBalance(token, amount);
            if (!hasBalance) {
                throw { status: 400, message: "Insufficient balance in internal Klar Wallet" };
            }
            
            const deductSuccess = await WalletUtil.deductBalance(
                token, 
                amount, 
                finalPayload.quotationInfo.quoteId, 
                `Cabs Booking - ${payload.routeDetail?.origin?.displayAddress} to ${payload.routeDetail?.destination?.displayAddress}`
            );
            
            if (!deductSuccess) {
                throw { status: 400, message: "Wallet deduction failed" };
            }
            console.log(`✅ [BookingService] Successfully deducted ₹${amount} from Klar Wallet`);
        }

        const response = await tripJackCabsProvider.createBooking(finalPayload);

        const bookingId = response?.data?.id || response?.data?.bookingId;

        // Trigger Payment to move to CONFIRMED
        let status = CabBookingStatus.PENDING;
        let paymentResponse: any = null;

        if (bookingId) {
            try {
                if (amount > 0) {
                    const paymentPayload = {
                        bookingId,
                        amount,
                        paymentMedium: "WALLET",
                        opType: "DEBIT",
                        product: "CAB",
                        transactionType: "PAID_FOR_ORDER",
                        payUserId: String(agent.agentId)
                    };
                    console.log("[BookingService] Triggering TripJack Payment API for booking:", bookingId);
                    paymentResponse = await tripJackCabsProvider.createPayment(paymentPayload);

                    if (paymentResponse?.success || paymentResponse?.data?.[0]?.status === "SUCCESS") {
                        console.log(`✅ [BookingService] Payment deducted for ${bookingId}. Polling for vendor final fulfillment status...`);
                        let finalStatus: string | undefined;
                        let finalPaymentStatus: string | undefined;

                        for (let attempt = 1; attempt <= 4; attempt++) {
                            await new Promise(r => setTimeout(r, 2500)); // wait 2.5s per attempt (up to 10s total)
                            try {
                                const detailsRes = await tripJackCabsProvider.getBookingDetails(bookingId);
                                finalStatus = detailsRes?.data?.[0]?.order?.status;
                                finalPaymentStatus = detailsRes?.data?.[0]?.order?.paymentStatus;
                                console.log(`[BookingService] Polling attempt ${attempt}/4 - Status: ${finalStatus} | paymentStatus: ${finalPaymentStatus}`);

                                // If vendor has explicitly confirmed or failed, break early
                                if (finalStatus === "CONFIRMED" || finalStatus === "FAILED") {
                                    break;
                                }
                            } catch (pollErr: any) {
                                console.warn(`⚠️ [BookingService] Polling attempt ${attempt} failed:`, pollErr?.message || pollErr);
                            }
                        }

                        if (finalStatus === "CONFIRMED" || finalStatus === "PAYMENT_SUCCESS") {
                            status = CabBookingStatus.CONFIRMED;
                            if (response?.data) {
                                response.data.status = "CONFIRMED";
                                response.data.paymentStatus = "SUCCESS";
                            }
                            console.log(`✅ [BookingService] Booking ${bookingId} successfully CONFIRMED by vendor.`);
                        } else if (finalStatus === "FAILED") {
                            status = CabBookingStatus.FAILED;
                            if (response?.data) {
                                response.data.status = "FAILED";
                                response.data.paymentStatus = finalPaymentStatus || "REFUND_SUCCESS";
                            }
                            console.error(`❌ [BookingService] Booking ${bookingId} FAILED by vendor. Auto-refunded TripJack payment.`);
                            
                            // Also refund the Klar Wallet
                            if (amount > 0) {
                                await WalletUtil.refundBalance(token, amount, bookingId, "Auto-refund: TripJack booking failed");
                                console.log(`✅ [BookingService] Refunded ₹${amount} to Klar Wallet for failed booking ${bookingId}`);
                            }
                        } else {
                            // If still pending/processing after 10s, return optimistic success to avoid blocking agent
                            status = CabBookingStatus.CONFIRMED;
                            if (response?.data) {
                                response.data.status = "CONFIRMED";
                                response.data.paymentStatus = "SUCCESS";
                            }
                            console.log(`⚠️ [BookingService] Vendor fulfillment still processing for ${bookingId}, returning optimistic CONFIRMED.`);
                        }
                    } else {
                        console.warn(`⚠️ [BookingService] Payment failed/pending for booking ${bookingId}`);
                    }
                } else {
                    status = CabBookingStatus.CONFIRMED;
                }
            } catch (payError) {
                console.error("❌ [BookingService] TripJack Payment API error:", payError);
            }

            try {
                const opt = payload.quotationInfo;
                const pricing = payload.pricingInfo;

                await CabBookingModel.create({
                    bookingId,
                    correlationId: finalPayload.correlationId,
                    userId: payload.userId || "guest", // Save userId from payload
                    status: status,
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
