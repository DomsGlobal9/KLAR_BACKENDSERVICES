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
import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
import { flightAgencyBookingConfirmationTemplate } from "../templates/flight-agency-booking-confirmation.template";
import { json } from "zod";
import { mapToUnifiedEmailData } from "../utils/mappers/emailData.mapper";


class BookingService {

    private bookingRepo = new BookingRepository();

    private async sendEmail(
        to: string,
        subject: string,
        html: string
    ) {
        try {

            await axios.post(`${envConfig.EMAIL_SERVICE}/email/send`, {
                to,
                subject,
                html
            });

            console.log("Email sent successfully");
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
            for (const traveller of travellers) {
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

        // Then update prices separately
        const priceUpdateQuery: any = {};
        if (tripjackPrice !== undefined) priceUpdateQuery.tripjackPrice = tripjackPrice;
        if (markupPrice !== undefined) priceUpdateQuery.markupPrice = markupPrice;
        if (totalPrice !== undefined) priceUpdateQuery.totalPrice = totalPrice;
        if (isHold !== undefined) priceUpdateQuery.isHold = isHold;

        if (Object.keys(priceUpdateQuery).length > 0) {
            await this.bookingRepo.updatePrices(bookingId, priceUpdateQuery);
        }

        // Get the updated booking
        const updatedBooking = await this.bookingRepo.getBookingById(bookingId);

        if (!updatedBooking) {
            throw new Error("Failed to get updated booking");
        }

        console.log("FINAL UPDATED BOOKING TRAVELLERS:", JSON.stringify(updatedBooking.travellers, null, 2));

        // Prepare payload for Tripjack
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
        console.log("#############################################");

        if (response.data.status.success === true) {

            /**
             * Data getting from Tripjack
             */
            const tripjackBookingStatus = await TripjackBookingService.getBookingDetails(updatedBooking.bookingId);
            const ourDatabaseBookingData = await this.bookingRepo.getBookingById(updatedBooking.bookingId);
            console.log("I am getting data from tripjack", JSON.stringify(tripjackBookingStatus, null, 2));
            console.log("I am getting data from ourside", JSON.stringify(ourDatabaseBookingData, null, 2));

            // Map data to unified format
            const unifiedEmailData = mapToUnifiedEmailData(
                tripjackBookingStatus,
                ourDatabaseBookingData as Booking
            );


            console.log("Booking status i get: ", JSON.stringify(tripjackBookingStatus, null, 2));
            await this.bookingRepo.updateBookingStatus(
                bookingId,
                tripjackBookingStatus?.order?.status
            );

            const to =
                tripjackBookingStatus?.order?.DeliveryInformation?.Emails?.[0] ||
                updatedBooking?.email || "";

            if (!to) {
                console.warn("No email found for booking:", updatedBooking.bookingId);
                return response.data;
            } else {

                //     const templateData = {
                //         ...tripjackBookingStatus,
                //         travellers: updatedBooking.travellers,
                //         totalPrice: updatedBooking.totalPrice,
                //         tripjackPrice: updatedBooking.tripjackPrice,
                //         markupPrice: updatedBooking.markupPrice
                //     };

                //     // Always send customer email (B2C + B2B)
                //     const customerHtml = flightBookingConfirmationTemplate(
                //         templateData,
                //         ""
                //     );

                //     await this.sendEmail(
                //         to,
                //         `Flight Booking Confirmation - ${updatedBooking.bookingId}`,
                //         customerHtml
                //     );

                //     // Send agency email only for B2B
                //     if (updatedBooking.userInfo?.clientType === "B2B") {

                //         const agencyHtml = flightAgencyBookingConfirmationTemplate(
                //             templateData,
                //             ""
                //         );

                //         const agencyEmail = updatedBooking.userInfo?.email;

                //         if (agencyEmail) {
                //             await this.sendEmail(
                //                 agencyEmail,
                //                 `Agency Booking Confirmation - ${updatedBooking.bookingId}`,
                //                 agencyHtml
                //             );
                //         }
                //     }
                // }

                // Create template data with both structures
                // Transform flights to match template's expected structure
                const transformedSegments = unifiedEmailData.flights.map(flight => ({
                    DepartureAirport: {
                        cityCode: flight.from.code,
                        SSRCode: flight.from.code,
                        city: flight.from.city,
                        AirlineName: flight.from.name,
                        country: flight.from.country,
                        terminal: flight.from.terminal
                    },
                    ArrivalAirport: {
                        cityCode: flight.to.code,
                        SSRCode: flight.to.code,
                        city: flight.to.city,
                        AirlineName: flight.to.name,
                        country: flight.to.country,
                        terminal: flight.to.terminal
                    },
                    DepartureTime: flight.departureTime,
                    ArrivalTime: flight.arrivalTime,
                    Duration: flight.duration,
                    NumberOfStops: flight.stops,
                    FlightDetails: {
                        AirlineInfo: {
                            SSRCode: flight.airlineCode,
                            AirlineName: flight.airline
                        },
                        FirstName: flight.flightNumber,
                        EquipmentType: flight.equipmentType
                    }
                }));

                const templateData = {
                    unifiedData: unifiedEmailData,
                    allSegments: transformedSegments,  // Use transformed segments instead of flights
                    passengers: unifiedEmailData.travellers || [],
                    order: { BookingId: unifiedEmailData.bookingId },
                    totalPrice: unifiedEmailData.priceBreakdown?.totalPrice
                };

                const customerHtml = flightBookingConfirmationTemplate(
                    templateData,  // ← Pass the wrapped data
                    ""
                );

                await this.sendEmail(
                    to,
                    `Flight Booking Confirmation - ${updatedBooking.bookingId}`,
                    customerHtml
                );

                // Send agency email only for B2B
                if (updatedBooking.userInfo?.clientType === "B2B") {
                    const agencyHtml = flightAgencyBookingConfirmationTemplate(
                        templateData,
                        ""
                    );

                    const agencyEmail = updatedBooking.userInfo?.email;

                    if (agencyEmail) {
                        await this.sendEmail(
                            agencyEmail,
                            `Agency Booking Confirmation - ${updatedBooking.bookingId}`,
                            agencyHtml
                        );
                    }
                }
            }

            return response.data;
        } else {
            console.error("Tripjack booking failed:", response.data);
            return null;
        }
    }

    async getBookingsByUserId(userId: string) {
        if (!userId) {
            throw new Error("userId is required");
        }

        return await this.bookingRepo.getBookingsByUserId(userId);
    }

    async getBookingDetails(bookingId: string, userId?: string) {
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