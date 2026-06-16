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
        const { bookingId, travellers, tripjackPrice, markupPrice, totalPrice, isHold } = data;

        if (travellers?.length) {
            for (let i = 0; i < travellers.length; i++) {
                const traveller = travellers[i];
                await this.bookingRepo.updateTravellerSSR(
                    bookingId,
                    traveller.travellerId,
                    {
                        ssrSeatInfos: traveller.ssrSeatInfos || [],
                        ssrMealInfos: traveller.ssrMealInfos || [],
                        ssrBaggageInfos: traveller.ssrBaggageInfos || []
                    }
                );
            }
        }

        const priceUpdateQuery: any = {};
        if (tripjackPrice !== undefined) priceUpdateQuery.tripjackPrice = tripjackPrice;
        if (markupPrice !== undefined) priceUpdateQuery.markupPrice = markupPrice;
        if (totalPrice !== undefined) priceUpdateQuery.totalPrice = totalPrice;
        if (isHold !== undefined) priceUpdateQuery.isHold = isHold;

        if (Object.keys(priceUpdateQuery).length > 0) {
            await this.bookingRepo.updatePrices(bookingId, priceUpdateQuery);
        }

        let updatedBooking;
        try {
            updatedBooking = await this.bookingRepo.getBookingById(bookingId);
            if (!updatedBooking) {
                throw new Error("Failed to get updated booking");
            }
        } catch (error: any) {
            throw error;
        }

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
        }

        validateBookingPayload(tripjackPayload);

        const mapped = mapToTripjackBooking(tripjackPayload);

        const response = await TripjackBookingService.book(mapped);

        if (response?.data?.status?.success === true) {
            try {
                const tripjackBookingStatus = await TripjackBookingService.getBookingDetails(updatedBooking.bookingId);

                await this.bookingRepo.updateBookingStatus(
                    bookingId,
                    tripjackBookingStatus?.order?.status
                );

                const to = tripjackBookingStatus?.order?.deliveryInfo?.emails?.[0] ||
                    tripjackBookingStatus?.order?.contactInfo?.emails?.[0] ||
                    updatedBooking?.email || "";

                if (to) {
                    const html = flightConfirmationTemplate(tripjackBookingStatus);
                    await this.sendEmail(
                        to,
                        `Flight Booking Confirmation - ${updatedBooking.bookingId}`,
                        html
                    );
                }

                return response.data;
            } catch (error: any) {
                return response.data;
            }
        } else {
            return null;
        }
    }

    // async updateAndTriggerBooking(data: {
    //     bookingId: string;
    //     travellers?: any[];
    //     tripjackPrice?: number;
    //     markupPrice?: number;
    //     totalPrice?: number;
    //     isHold: boolean;
    // }) {
    //     const { bookingId, travellers, tripjackPrice, markupPrice, totalPrice, isHold } = data;

    //     if (travellers?.length) {
    //         for (const traveller of travellers) {
    //             await this.bookingRepo.updateTravellerSSR(
    //                 bookingId,
    //                 traveller.travellerId,
    //                 {
    //                     ssrSeatInfos: traveller.ssrSeatInfos || [],
    //                     ssrMealInfos: traveller.ssrMealInfos || [],
    //                     ssrBaggageInfos: traveller.ssrBaggageInfos || []
    //                 }
    //             );
    //         }
    //     }

    //     // Then update prices separately
    //     const priceUpdateQuery: any = {};
    //     if (tripjackPrice !== undefined) priceUpdateQuery.tripjackPrice = tripjackPrice;
    //     if (markupPrice !== undefined) priceUpdateQuery.markupPrice = markupPrice;
    //     if (totalPrice !== undefined) priceUpdateQuery.totalPrice = totalPrice;
    //     if (isHold !== undefined) priceUpdateQuery.isHold = isHold;

    //     if (Object.keys(priceUpdateQuery).length > 0) {
    //         await this.bookingRepo.updatePrices(bookingId, priceUpdateQuery);
    //     }

    //     // Get the updated booking
    //     const updatedBooking = await this.bookingRepo.getBookingById(bookingId);

    //     if (!updatedBooking) {
    //         throw new Error("Failed to get updated booking");
    //     }


    //     // Prepare payload for Tripjack
    //     const tripjackPayload: FrontendBookingPayload = {
    //         bookingId: updatedBooking.bookingId,
    //         email: updatedBooking.email,
    //         phone: updatedBooking.phone,
    //         travellers: updatedBooking.travellers,
    //         amount: updatedBooking.tripjackPrice || 0,
    //         isHold: updatedBooking.isHold,
    //         emergencyContact: updatedBooking.emergencyContact
    //     };

    //     if (updatedBooking.gstInfo?.gstNumber) {
    //         tripjackPayload.gstInfo = updatedBooking.gstInfo;
    //     }

    //     validateBookingPayload(tripjackPayload);

    //     const mapped = mapToTripjackBooking(tripjackPayload);

    //     const response = await TripjackBookingService.book(mapped);

    //     if (response.data.status.success === true) {
    //         const tripjackBookingStatus = await TripjackBookingService.getBookingDetails(updatedBooking.bookingId);

    //         await this.bookingRepo.updateBookingStatus(
    //             bookingId,
    //             tripjackBookingStatus?.order?.status
    //         );

    //         const to =
    //             tripjackBookingStatus?.order?.deliveryInfo?.emails?.[0] ||
    //             tripjackBookingStatus?.order?.contactInfo?.emails?.[0] ||
    //             updatedBooking?.email || "";

    //         if (!to) {
    //             console.warn("No email found for booking:", updatedBooking.bookingId);
    //             return response.data;
    //         } else {
    //             const html = flightConfirmationTemplate(tripjackBookingStatus);

    //             await this.sendEmail(
    //                 to,
    //                 `Flight Booking Confirmation - ${updatedBooking.bookingId}`,
    //                 html
    //             );
    //         }

    //         return response.data;
    //     } else {
    //         console.error("Tripjack booking failed:", response.data);
    //         return null;
    //     }
    // }

    async getBookingsByUserId(userId: string) {
        if (!userId) {
            throw new Error("userId is required");
        }

        return await this.bookingRepo.getBookingsByUserId(userId);
    }

    async getBookingDetails(bookingId: string, userId: string) {
        if (!bookingId) {
            throw new Error("bookingId is required");
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
}

export default new BookingService();