import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { envConfig } from "../config/env.config";
import { Booking } from "../types/bookingLocal.types";
import { formatPhoneNumber } from "../utils/helper/phoneFormater.helper";
import { BookingRepository } from "../repositories/bookingLocal.repository";
import { validateBookingPayload } from "../utils/tripjackBookingVerifier";
import { mapToTripjackBooking } from "../utils/mappers/booking.mapper";
import TripjackBookingService from "./booking.service";
import { FrontendBookingPayload } from "../types/booking.types";
import { flightConfirmationTemplate } from "../templates/flightConfirmationTemplate";


class BookingService {

    private bookingRepo = new BookingRepository();

    private async sendEmail(
        to: string,
        subject: string,
        html: string
    ) {
        try {
            await axios.post(`${envConfig.EMAIL_SERVICE}/send`, {
                to,
                subject,
                html
            });
        } catch (error: any) {
            console.error(
                "Email send failed:",
                error.response?.data || error.message
            );
        }
    }

    async createInitialBooking(data: Partial<Booking>, userData: any) {


        if (!data.bookingId) {
            throw new Error("bookingId is required");
        }

        if (!data.travellers || data.travellers.length === 0) {
            throw new Error("At least one traveller is required");
        }

        const travellersWithId = data.travellers.map((traveller) => ({
            ...traveller,
            travellerId: uuidv4()
        }));

        let emergencyContact = data.emergencyContact;

        if (emergencyContact?.phone) {
            emergencyContact.phone = formatPhoneNumber(
                emergencyContact.phone
            );
        }

        const userInfo = {
            id: userData.id,
            email: userData.email,
            role: userData.roles?.[0] || "",
            clientType: userData.clientType
        };

        const payload: Booking = {
            bookingId: data.bookingId,
            amount: 0,
            email: data.email || "",
            phone: data.phone || "",
            isHold: false,
            travellers: travellersWithId,
            status: "INITIATED",
            userInfo,
            ...(data.gstInfo && { gstInfo: data.gstInfo }),
            ...(data.emergencyContact && { emergencyContact })
        };

        return await this.bookingRepo.createBooking(payload);
    }

    async updateTravellerSSR(data: {
        bookingId: string;
        travellerId: string;
        ssrSeatInfos?: any[];
        ssrMealInfos?: any[];
        ssrBaggageInfos?: any[];
    }) {
        if (!data.bookingId || !data.travellerId) {
            throw new Error("bookingId and travellerId required");
        }

        return await this.bookingRepo.updateTravellerSSR(
            data.bookingId,
            data.travellerId,
            data
        );
    }

    async updateBookingPrices(data: {
        bookingId: string;
        tripjackPrice?: number;
        markupPrice?: number;
        totalPrice?: number;
    }) {
        if (!data.bookingId) {
            throw new Error("bookingId required");
        }

        const priceData = {
            ...(data.tripjackPrice !== undefined && { tripjackPrice: data.tripjackPrice }),
            ...(data.markupPrice !== undefined && { markupPrice: data.markupPrice }),
            ...(data.totalPrice !== undefined && { totalPrice: data.totalPrice })
        };

        return await this.bookingRepo.updatePrices(data.bookingId, priceData);
    }

    async updateBookingDetails(data: {
        bookingId: string;
        travellers?: any[];
        tripjackPrice?: number;
        markupPrice?: number;
        totalPrice?: number;
    }) {
        const { bookingId, travellers, tripjackPrice, markupPrice, totalPrice } = data;

        const updateQuery: any = {};

        if (travellers && travellers.length > 0) {
            const existingBooking = await this.bookingRepo.getBookingById(bookingId);

            if (!existingBooking) {
                throw new Error("Booking not found");
            }

            const updatedTravellers = existingBooking.travellers.map((t: any) => {
                const incoming = travellers.find(
                    (tr: any) => tr.travellerId === t.travellerId
                );

                if (incoming) {
                    return {
                        ...t,
                        ssrSeatInfos: incoming.ssrSeatInfos || t.ssrSeatInfos,
                        ssrMealInfos: incoming.ssrMealInfos || t.ssrMealInfos,
                        ssrBaggageInfos: incoming.ssrBaggageInfos || t.ssrBaggageInfos
                    };
                }

                return t;
            });

            updateQuery.travellers = updatedTravellers;
        }

        if (tripjackPrice !== undefined) {
            updateQuery.tripjackPrice = tripjackPrice;
        }

        if (markupPrice !== undefined) {
            updateQuery.markupPrice = markupPrice;
        }

        if (totalPrice !== undefined) {
            updateQuery.totalPrice = totalPrice;
        }

        return await this.bookingRepo.updateBooking(bookingId, updateQuery);
    }

   async updateAndTriggerBooking(data: {
        bookingId: string;
        travellers?: any[];
        tripjackPrice?: number;
        markupPrice?: number;
        totalPrice?: number;
        isHold: boolean;
    }) {
        console.log("[DEBUG] updateAndTriggerBooking called with data:", JSON.stringify(data, null, 2));
        const { bookingId, travellers, tripjackPrice, markupPrice, totalPrice, isHold } = data;

        if (travellers?.length) {
            console.log(`[DEBUG] Processing ${travellers.length} travellers for SSR updates`);
            for (let i = 0; i < travellers.length; i++) {
                const traveller = travellers[i];
                console.log(`[DEBUG] Updating traveller ${i + 1}/${travellers.length} with ID: ${traveller.travellerId}`);
                await this.bookingRepo.updateTravellerSSR(
                    bookingId,
                    traveller.travellerId,
                    {
                        ssrSeatInfos: traveller.ssrSeatInfos || [],
                        ssrMealInfos: traveller.ssrMealInfos || [],
                        ssrBaggageInfos: traveller.ssrBaggageInfos || []
                    }
                );
                console.log(`[DEBUG] Traveller ${traveller.travellerId} updated successfully`);
            }
        } else {
            console.log("[DEBUG] No travellers to update");
        }

        const priceUpdateQuery: any = {};
        if (tripjackPrice !== undefined) {
            priceUpdateQuery.tripjackPrice = tripjackPrice;
            console.log(`[DEBUG] Setting tripjackPrice: ${tripjackPrice}`);
        }
        if (markupPrice !== undefined) {
            priceUpdateQuery.markupPrice = markupPrice;
            console.log(`[DEBUG] Setting markupPrice: ${markupPrice}`);
        }
        if (totalPrice !== undefined) {
            priceUpdateQuery.totalPrice = totalPrice;
            console.log(`[DEBUG] Setting totalPrice: ${totalPrice}`);
        }
        if (isHold !== undefined) {
            priceUpdateQuery.isHold = isHold;
            console.log(`[DEBUG] Setting isHold: ${isHold}`);
        }

        if (Object.keys(priceUpdateQuery).length > 0) {
            console.log("[DEBUG] Updating prices with query:", priceUpdateQuery);
            await this.bookingRepo.updatePrices(bookingId, priceUpdateQuery);
            console.log("[DEBUG] Prices updated successfully");
        } else {
            console.log("[DEBUG] No price updates to apply");
        }

        let updatedBooking;
        try {
            console.log("[DEBUG] Fetching updated booking by ID:", bookingId);
            updatedBooking = await this.bookingRepo.getBookingById(bookingId);
            if (!updatedBooking) {
                console.error("[DEBUG] Failed to get updated booking - booking not found");
                throw new Error("Failed to get updated booking");
            }
            console.log("[DEBUG] Updated booking fetched successfully. Booking ID:", updatedBooking.bookingId);
        } catch (error: any) {
            console.error("[DEBUG] Error fetching updated booking:", error.message);
            throw error;
        }

        console.log("[DEBUG] Preparing tripjack payload");
        const tripjackPayload: FrontendBookingPayload = {
            bookingId: updatedBooking.bookingId,
            email: updatedBooking.email,
            phone: updatedBooking.phone,
            travellers: updatedBooking.travellers,
            amount: updatedBooking.tripjackPrice || 0,
            isHold: updatedBooking.isHold,
            emergencyContact: updatedBooking.emergencyContact
        };

        if (updatedBooking.gstInfo?.gstNumber) {
            tripjackPayload.gstInfo = updatedBooking.gstInfo;
            console.log("[DEBUG] GST info added to payload");
        }
        console.log("[DEBUG] Tripjack payload prepared:", JSON.stringify(tripjackPayload, null, 2));
        console.log("First response................");
        // validateBookingPayload(tripjackPayload);
        console.log("Second response................");
        console.log("[DEBUG] Validating booking payload - success");
        const mapped = mapToTripjackBooking(tripjackPayload);
        console.log("Third response................");
        console.log("[DEBUG] Mapped to tripjack booking format");

        console.log("[DEBUG] Calling TripjackBookingService.book()");
        const response = await TripjackBookingService.book(mapped);
        console.log("Forth response................");
        console.log("[DEBUG] Tripjack booking service response status:", response?.data?.status?.success);

        if (response?.data?.status?.success === true) {
            console.log("[DEBUG] Tripjack booking successful");
            try {
                console.log("[DEBUG] Fetching booking details from Tripjack for ID:", updatedBooking.bookingId);
                const tripjackBookingStatus = await TripjackBookingService.getBookingDetails(updatedBooking.bookingId);
                console.log("[DEBUG] Tripjack booking status fetched. Status:", tripjackBookingStatus?.order?.status);

                console.log("[DEBUG] Updating booking status in repository to:", tripjackBookingStatus?.order?.status);
                await this.bookingRepo.updateBookingStatus(
                    bookingId,
                    tripjackBookingStatus?.order?.status
                );
                console.log("[DEBUG] Booking status updated successfully");

                const to = tripjackBookingStatus?.order?.deliveryInfo?.emails?.[0] ||
                    tripjackBookingStatus?.order?.contactInfo?.emails?.[0] ||
                    updatedBooking?.email || "";
                console.log("[DEBUG] Sending confirmation email to:", to);

                if (to) {
                    const html = flightConfirmationTemplate(tripjackBookingStatus);
                    await this.sendEmail(
                        to,
                        `Flight Booking Confirmation - ${updatedBooking.bookingId}`,
                        html
                    );
                    console.log("[DEBUG] Confirmation email sent successfully");
                } else {
                    console.warn("[DEBUG] No recipient email found for confirmation");
                }

                console.log("[DEBUG] Returning success response");
                return response.data;
            } catch (error: any) {
                console.error("[DEBUG] Error in post-booking success flow:", error.message);
                console.log("[DEBUG] Returning response data despite error in downstream operations");
                return response.data;
            }
        } else {
            console.warn("[DEBUG] Tripjack booking was not successful. Returning null");
            return null;
        }
    }


    async getBookingsByUserId(userId: string) {
        if (!userId) {
            throw new Error("userId is required");
        }

        return await this.bookingRepo.getBookingsByUserId(userId);
    }

    // async getBookingDetails(bookingId: string, userId?: string, source?: string) {

    //     if (!bookingId) {
    //         throw new Error("bookingId is required");
    //     }

    //     if (source === 'b2c') {
    //         const booking = await this.bookingRepo.getBookingByBookingId(bookingId);
    //         if (!booking) {
    //             throw new Error("Booking not found");
    //         }
    //         return booking;
    //     }

    //     else if (userId) {
    //         const booking = await this.bookingRepo.getBookingByIdAndUser(
    //             bookingId,
    //             userId as string,
    //         );

    //         if (!booking) {
    //             throw new Error("Booking not found or unauthorized");
    //         }

    //         return booking;
    //     }
    // }





    async getBookingDetailsBySource(bookingId: string, source: string) {
        if (!bookingId) {
            throw new Error("bookingId is required");
        }

        if (source === 'b2c') {
            const booking = await this.bookingRepo.getBookingByBookingId(bookingId);
            if (!booking) {
                throw new Error("Booking not found");
            }
            return booking;
        }

        throw new Error("Invalid source parameter");
    }

    async getBookingDetailsByUser(bookingId: string, userId: string) {
        if (!bookingId || !userId) {
            throw new Error("bookingId and userId are required");
        }

        const booking = await this.bookingRepo.getBookingByIdAndUser(
            bookingId,
            userId
        );

        if (!booking) {
            throw new Error("Booking not found or unauthorized");
        }

        return booking;
    }

    async getBookingDetails(bookingId: string, userId?: string, source?: string) {
        if (source === 'b2c') {
            return this.getBookingDetailsBySource(bookingId, source);
        } else if (userId) {
            return this.getBookingDetailsByUser(bookingId, userId);
        }
        throw new Error("Either userId or source must be provided");
    }

    async checkBookingExistsByEmail(email: string): Promise<boolean> {
        if (!email) {
            throw new Error("Email is required");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error("Invalid email format");
        }

        const booking = await this.bookingRepo.findBookingByEmail(email);
        return !!booking;
    }

    async getBookingsByEmail(email: string) {
        if (!email) {
            throw new Error("Email is required");
        }

        return await this.bookingRepo.getBookingsByEmail(email);
    }
}

export default new BookingService();