import { v4 as uuidv4 } from "uuid";
import { Booking } from "../types/bookingLocal.types";
import { formatPhoneNumber } from "../utils/helper/phoneFormater.helper";
import { BookingRepository } from "../repositories/bookingLocal.repository";

class BookingService {

    private bookingRepo = new BookingRepository();

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
}

export default new BookingService();