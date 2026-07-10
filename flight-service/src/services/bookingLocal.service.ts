import axios from "axios";
import Handlebars from 'handlebars';
import { v4 as uuidv4 } from "uuid";
import { envConfig } from "../config/env.config";
import { Booking } from "../types/bookingLocal.types";
import { getLogoBase64 } from "../utils/helper/logo.utils";
import { formatPhoneNumber } from "../utils/helper/phoneFormater.helper";
import { BookingRepository } from "../repositories/bookingLocal.repository";
import { validateBookingPayload } from "../utils/tripjackBookingVerifier";
import { mapToTripjackBooking } from "../utils/mappers/booking.mapper";
import TripjackBookingService from "./booking.service";
import { FrontendBookingPayload } from "../types/booking.types";
import { flightConfirmationTemplate } from "../templates/flightConfirmationTemplate";
import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
import { flightAgencyBookingConfirmationTemplate } from "../templates/flight-agency-booking-confirmation.template";


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
            // Email send failed silently
        }
    }

    constructor() {
        this.registerHandlebarsHelpers();
    }

    private registerHandlebarsHelpers() {
        Handlebars.registerHelper('formatDate', function (dateString: string) {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        });

        Handlebars.registerHelper('formatTime', function (dateString: string) {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        });

        Handlebars.registerHelper('formatPrice', function (price: number) {
            if (!price) return '₹0';
            return `₹${price.toFixed(2)}`;
        });

        Handlebars.registerHelper('getAirlineName', function (airlineInfo: any) {
            return airlineInfo?.AirlineName || 'N/A';
        });

        Handlebars.registerHelper('hasPassport', function (traveller: any) {
            return traveller && traveller.passportNumber && traveller.passportNumber.trim() !== '';
        });

        Handlebars.registerHelper('hasGst', function (gstInfo: any) {
            return gstInfo && gstInfo.gstNumber && gstInfo.gstNumber.trim() !== '';
        });

        Handlebars.registerHelper('defaultIfEmpty', function (value: any, defaultValue: string) {
            return value && value.toString().trim() !== '' ? value : defaultValue;
        });

        Handlebars.registerHelper('ifCond', function (this: any, v1: any, operator: string, v2: any, options: any) {
            switch (operator) {
                case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
                case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
                case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                case '&&': return (v1 && v2) ? options.fn(this) : options.inverse(this);
                case '||': return (v1 || v2) ? options.fn(this) : options.inverse(this);
                default: return options.inverse(this);
            }
        });
    }

    private async sendBookingEmails(bookingId: string) {
        try {
            const booking = await this.bookingRepo.getBookingById(bookingId);
            if (!booking) return;

            const [tripjackData, dbData] = await Promise.all([
                TripjackBookingService.getBookingDetails(bookingId),
                this.getBookingDetails(bookingId),
            ]);

            if (!tripjackData) return;

            await this.bookingRepo.updateBookingStatus(bookingId, tripjackData?.order?.status);

            const travellerEmail = tripjackData?.order?.DeliveryInformation?.Emails?.[0] ||
                tripjackData?.order?.contactInfo?.emails?.[0] ||
                booking?.email || "";

            const agentEmail = dbData?.userInfo?.email || "";

            const tripInfo = tripjackData?.itemInfos?.AIR?.TripInformation || [];
            const segments = [];
            for (const trip of tripInfo) {
                for (const segment of (trip.SegmentInformation || [])) {
                    segments.push({
                        departureAirport: segment.DepartureAirport,
                        arrivalAirport: segment.ArrivalAirport,
                        departureTime: segment.DepartureTime,
                        arrivalTime: segment.ArrivalTime,
                        flightDetails: segment.FlightDetails,
                        duration: segment.Duration,
                        numberOfStops: segment.NumberOfStops,
                        baggageInfo: segment.BaggageInfo,
                    });
                }
            }

            const travellers = tripjackData?.itemInfos?.AIR?.TravellerInformation || [];
            const formattedTravellers = travellers.map((t: any) => ({
                title: t.Title || '',
                firstName: t.FirstName || '',
                lastName: t.LastName || '',
                paxType: t.PaxType || '',
                dateOfBirth: t.DateOfBirth || '',
                seatInfo: t.SSR_Seat_Information || {},
                mealInfo: t.SSR_Meal_Information || {},
                baggageInfo: t.SSR_Baggage_Information || {},
                pnrDetails: t.pnrDetails || {},
                passportNumber: t.PassportNumber || '',
                passportNationality: t.PassportNationality || '',
                passportIssueDate: t.PassportIssueDate || '',
                passportExpiryDate: t.PassportExpiryDate || '',
            }));

            const gstInfo = tripjackData?.GSTInformation || booking?.gstInfo || null;
            const formattedGstInfo = gstInfo ? {
                gstNumber: gstInfo.GSTNumber || gstInfo.gstNumber || '',
                registeredName: gstInfo.RegisteredName || gstInfo.registeredName || '',
                email: gstInfo.email || '',
                mobile: gstInfo.mobile || '',
                address: gstInfo.address || '',
                isSez: gstInfo.isez || gstInfo.isSez || false
            } : null;

            const emergencyContact = tripjackData?.order?.EmergencyContactInformation || {};
            const formattedEmergencyContact = {
                name: emergencyContact.EmergencyContactName || '',
                email: emergencyContact.Emails?.[0] || '',
                phone: emergencyContact.Contacts?.[0] || ''
            };

            const templateData = {
                bookingId: tripjackData?.order?.BookingId || booking?.bookingId || '',
                bookingDate: tripjackData?.order?.createdOn || new Date().toISOString(),
                status: tripjackData?.order?.status || '',
                totalAmount: tripjackData?.order?.Amount || 0,
                totalPrice: booking?.totalPrice || 0,
                markupPrice: booking?.markupPrice || 0,
                tripjackPrice: booking?.tripjackPrice || 0,
                travellers: formattedTravellers,
                segments: segments,
                emergencyContact: formattedEmergencyContact,
                travellerEmail: booking?.email || '',
                agentEmail: dbData?.userInfo?.email || '',
                isMultiCity: segments.length > 1,
                isRoundTrip: segments.length === 2,
                isOneWay: segments.length === 1,
                gstInfo: formattedGstInfo,
                order: tripjackData?.order || {},
            };

            const clientTemplate = Handlebars.compile(flightBookingConfirmationTemplate, {
                strict: false,
                assumeObjects: true
            });

            const agencyTemplate = Handlebars.compile(flightAgencyBookingConfirmationTemplate, {
                strict: false,
                assumeObjects: true
            });

            if (travellerEmail) {
                await this.sendEmail(
                    travellerEmail,
                    `Flight Booking Confirmation - ${bookingId}`,
                    clientTemplate(templateData)
                );
            }

            if (agentEmail && agentEmail !== travellerEmail) {
                await this.sendEmail(
                    agentEmail,
                    `Flight Booking Confirmation - ${bookingId} (Agency Copy)`,
                    agencyTemplate(templateData)
                );
            }

        } catch (error) {
            console.error(`Email failed for ${bookingId}:`, error);
        }
    }

    private async processBookingAftermath(
        updatedBooking: any,
        bookingId: string
    ) {
        try {
            console.log(`📦 [Booking] Processing aftermath for ${bookingId}`);
            console.log(`📦 [Update Booking] Processing aftermath for ${updatedBooking}`);

            const [tripjackBookingStatus, ownDatabaseBookingStatus] = await Promise.all([
                TripjackBookingService.getBookingDetails(updatedBooking.bookingId),
                this.getBookingDetails(updatedBooking.bookingId),
            ]);

            await this.bookingRepo.updateBookingStatus(
                bookingId,
                tripjackBookingStatus?.order?.status
            );

            const travellerEmail = tripjackBookingStatus?.order?.DeliveryInformation?.Emails?.[0] ||
                tripjackBookingStatus?.order?.contactInfo?.emails?.[0] ||
                updatedBooking?.email || "";

            const agentEmail = ownDatabaseBookingStatus?.userInfo?.email || "";

            console.log(`📧 [Booking] Traveller Email: ${travellerEmail}`);
            console.log(`📧 [Booking] Agent Email: ${agentEmail}`);

            const html = flightConfirmationTemplate(tripjackBookingStatus);
            const subject = `Flight Booking Confirmation - ${updatedBooking.bookingId}`;

            if (travellerEmail) {
                await this.sendEmail(
                    travellerEmail,
                    subject,
                    html
                );
                console.log(`✅ [Booking] Email sent to traveller: ${travellerEmail}`);
            }

            if (agentEmail && agentEmail !== travellerEmail) {
                await this.sendEmail(
                    agentEmail,
                    subject,
                    html
                );
                console.log(`✅ [Booking] Email sent to agent: ${agentEmail}`);
            }

            console.log(`✅ [Booking] Aftermath completed for ${bookingId}`);
        } catch (error: any) {
            console.error(`❌ [Booking] Aftermath failed for ${bookingId}:`, error.message);
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

        const existingBooking = await this.bookingRepo.getBookingById(data.bookingId);

        if (existingBooking) {
            const updateData: any = {
                email: payload.email,
                phone: payload.phone,
                isHold: payload.isHold,
                travellers: payload.travellers,
                userInfo: payload.userInfo,
                status: "INITIATED"
            };

            if (payload.gstInfo) {
                updateData.gstInfo = payload.gstInfo;
            }

            if (payload.emergencyContact) {
                updateData.emergencyContact = payload.emergencyContact;
            }

            if (existingBooking.tripjackPrice !== undefined) {
                updateData.tripjackPrice = existingBooking.tripjackPrice;
            }
            if (existingBooking.markupPrice !== undefined) {
                updateData.markupPrice = existingBooking.markupPrice;
            }
            if (existingBooking.totalPrice !== undefined) {
                updateData.totalPrice = existingBooking.totalPrice;
            }
            if (existingBooking.amount !== undefined) {
                updateData.amount = existingBooking.amount;
            }

            const updatedBooking = await this.bookingRepo.updateBooking(data.bookingId, updateData);
            return updatedBooking;
        }

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

        const mapped = mapToTripjackBooking(tripjackPayload);
        const response = await TripjackBookingService.book(mapped);

        if (response?.data?.status?.success === true) {
            const pnr = response.data.order?.pnr || response.data.pnr || "";
            const flightInfo = response.data.order || response.data || null;
            
            await this.bookingRepo.updatePrices(bookingId, {
                status: "SUCCESS",
                pnr: pnr,
                flightInfo: flightInfo
            });

            this.sendBookingEmails(bookingId);
            return response.data;
        } else {
            await this.bookingRepo.updatePrices(bookingId, { status: "FAILED" });
            return null;
        }
    }

    async getBookingsByUserId(userId: string) {
        if (!userId) {
            throw new Error("userId is required");
        }

        return await this.bookingRepo.getBookingsByUserId(userId);
    }

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

    async getBookingDetails(bookingId: string, userId?: string, source?: string) {
        if (source === 'b2c') {
            return this.getBookingDetailsBySource(bookingId, source);
        } else if (userId) {
            return this.getBookingDetailsByUser(bookingId, userId);
        }
        else {
            return this.bookingRepo.getBookingById(bookingId);
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







    // ===================================
    // ===================================
    // ==========TESTING==================
    // ===================================
    // ===================================



    async processBookingAftermathById(bookingId: string) {
        try {
            console.log(`🧪 [TEST] Processing aftermath for booking: ${bookingId}`);

            const booking = await this.bookingRepo.getBookingById(bookingId);
            if (!booking) {
                throw new Error("Booking not found");
            }

            const [tripjackBookingStatus, ownDatabaseBookingStatus] = await Promise.all([
                TripjackBookingService.getBookingDetails(bookingId),
                this.getBookingDetails(bookingId),
            ]);

            console.log("******************** TRIP Jack Booking Status get: \n", JSON.stringify(tripjackBookingStatus, null, 2));
            console.log("******************** Own Database Booking Status get: \n", JSON.stringify(ownDatabaseBookingStatus, null, 2));

            if (!tripjackBookingStatus) {
                throw new Error("Failed to get booking details from Tripjack");
            }

            const travellerEmail = tripjackBookingStatus?.order?.DeliveryInformation?.Emails?.[0] ||
                tripjackBookingStatus?.order?.contactInfo?.emails?.[0] ||
                booking?.email || "";

            const agentEmail = ownDatabaseBookingStatus?.userInfo?.email || "";

            console.log(`📧 [TEST] Traveller Email: ${travellerEmail}`);
            console.log(`📧 [TEST] Agent Email: ${agentEmail}`);

            // Register helpers
            Handlebars.registerHelper('formatDate', function (dateString: string) {
                if (!dateString) return 'N/A';
                const date = new Date(dateString);
                return date.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            });

            Handlebars.registerHelper('formatTime', function (dateString: string) {
                if (!dateString) return 'N/A';
                const date = new Date(dateString);
                return date.toLocaleString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            });

            Handlebars.registerHelper('formatPrice', function (price: number) {
                if (!price) return '₹0';
                return `₹${price.toFixed(2)}`;
            });

            Handlebars.registerHelper('getAirlineName', function (airlineInfo: any) {
                return airlineInfo?.AirlineName || 'N/A';
            });

            Handlebars.registerHelper('getFlightNumber', function (flightDetails: any) {
                return flightDetails?.FirstName || 'N/A';
            });

            // Transform data for templates
            const templateData = this.prepareTemplateData(
                tripjackBookingStatus,
                ownDatabaseBookingStatus,
                booking
            );

            console.log(`📧 [TEST] Template Data:`, JSON.stringify(templateData, null, 2));

            // Compile templates with proper options
            const clientTemplate = Handlebars.compile(flightBookingConfirmationTemplate, {
                strict: false,
                assumeObjects: true
            });

            const agencyTemplate = Handlebars.compile(flightAgencyBookingConfirmationTemplate, {
                strict: false,
                assumeObjects: true
            });

            if (travellerEmail) {
                const clientHtml = clientTemplate(templateData);
                await this.sendEmail(
                    travellerEmail,
                    `Flight Booking Confirmation - ${bookingId}`,
                    clientHtml
                );
                console.log(`✅ [TEST] Client email sent to traveller: ${travellerEmail}`);
            }

            if (agentEmail && agentEmail !== travellerEmail) {
                const agencyHtml = agencyTemplate(templateData);
                await this.sendEmail(
                    agentEmail,
                    `Flight Booking Confirmation - ${bookingId} (Agency Copy)`,
                    agencyHtml
                );
                console.log(`✅ [TEST] Agency email sent to agent: ${agentEmail}`);
            }

            console.log(`✅ [TEST] Aftermath completed for ${bookingId}`);

            return {
                success: true,
                bookingId,
                status: tripjackBookingStatus?.order?.status,
                emailSent: {
                    traveller: !!travellerEmail,
                    agent: !!agentEmail && agentEmail !== travellerEmail
                },
                emails: {
                    traveller: travellerEmail || null,
                    agent: (agentEmail && agentEmail !== travellerEmail) ? agentEmail : null
                }
            };
        } catch (error: any) {
            console.error(`❌ [TEST] Aftermath failed for ${bookingId}:`, error.message);
            return {
                success: false,
                bookingId,
                error: error.message
            };
        }
    }


    private prepareTemplateData(tripjackData: any, dbData: any, booking: any) {
        const tripInfo = tripjackData?.itemInfos?.AIR?.TripInformation || [];
        const segments = [];

        for (const trip of tripInfo) {
            const segmentInfo = trip.SegmentInformation || [];
            for (const segment of segmentInfo) {
                segments.push({
                    departureAirport: segment.DepartureAirport,
                    arrivalAirport: segment.ArrivalAirport,
                    departureTime: segment.DepartureTime,
                    arrivalTime: segment.ArrivalTime,
                    flightDetails: segment.FlightDetails,
                    duration: segment.Duration,
                    numberOfStops: segment.NumberOfStops,
                    baggageInfo: segment.BaggageInfo,
                    segmentNumber: segment.SegmentNumber
                });
            }
        }

        const travellers = tripjackData?.itemInfos?.AIR?.TravellerInformation || [];
        const formattedTravellers = travellers.map((traveller: any) => ({
            title: traveller.Title || '',
            firstName: traveller.FirstName || '',
            lastName: traveller.LastName || '',
            paxType: traveller.PaxType || '',
            dateOfBirth: traveller.DateOfBirth || '',
            seatInfo: traveller.SSR_Seat_Information || {},
            mealInfo: traveller.SSR_Meal_Information || {},
            baggageInfo: traveller.SSR_Baggage_Information || {},
            pnrDetails: traveller.pnrDetails || {},
            passportNumber: traveller.PassportNumber || '',
            passportNationality: traveller.PassportNationality || '',
            passportIssueDate: traveller.PassportIssueDate || '',
            passportExpiryDate: traveller.PassportExpiryDate || '',
        }));

        const gstInfo = tripjackData?.GSTInformation || booking?.gstInfo || null;
        const formattedGstInfo = gstInfo ? {
            gstNumber: gstInfo.GSTNumber || gstInfo.gstNumber || '',
            registeredName: gstInfo.RegisteredName || gstInfo.registeredName || '',
            email: gstInfo.email || '',
            mobile: gstInfo.mobile || '',
            address: gstInfo.address || '',
            isSez: gstInfo.isez || gstInfo.isSez || false
        } : null;

        return {
            bookingId: tripjackData?.order?.BookingId || booking?.bookingId || '',
            bookingDate: tripjackData?.order?.createdOn || new Date().toISOString(),
            status: tripjackData?.order?.status || '',
            totalAmount: tripjackData?.order?.Amount || 0,
            totalPrice: booking?.totalPrice || 0,
            markupPrice: booking?.markupPrice || 0,
            tripjackPrice: booking?.tripjackPrice || 0,
            travellers: formattedTravellers,
            segments: segments,
            emergencyContact: tripjackData?.order?.EmergencyContactInformation || {},
            deliveryInfo: tripjackData?.order?.DeliveryInformation || {},
            travellerEmail: booking?.email || '',
            agentEmail: dbData?.userInfo?.email || '',
            userInfo: dbData?.userInfo || {},
            isMultiCity: segments.length > 1,
            isRoundTrip: segments.length === 2,
            isOneWay: segments.length === 1,
            gstInfo: formattedGstInfo,
            order: tripjackData?.order || {},
        };
    }
}

export default new BookingService();