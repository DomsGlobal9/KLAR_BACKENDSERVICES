import axios from "axios";
import Handlebars from 'handlebars';
import { v4 as uuidv4 } from "uuid";
import { envConfig } from "../config/env.config";
import { Booking } from "../types/bookingLocal.types";
import { formatPhoneNumber } from "../utils/helper/phoneFormater.helper";
import { BookingRepository } from "../repositories/bookingLocal.repository";
import { mapToTripjackBooking } from "../utils/mappers/booking.mapper";
import TripjackBookingService from "./booking.service";
import { FrontendBookingPayload } from "../types/booking.types";
import { FlightReviewDataService } from "./flightReviewData.service";
import SeatService, { seatMapCacheKey } from "./seat.service";
import RedisCacheService from "../cache/redisCache.service";
import { validateBookingPayload } from "../utils/tripjackBookingVerifier";
import {
    verifyBookingAmount,
    BookingVerificationError,
} from "../utils/bookingVerification.util";
import {
    resolveBookingRequirements,
    isReviewExpired,
} from "../utils/reviewConditions.util";
import { parseUpfrontSeatError } from "../utils/upfrontSeatError.util";
import { flightConfirmationTemplate } from "../templates/flightConfirmationTemplate";
import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
import { flightAgencyBookingConfirmationTemplate } from "../templates/flight-agency-booking-confirmation.template";
import { cancellationRequestTemplate } from "../templates/flight-client-cancellation.template";
import { cancellationRequestAgencyTemplate } from "../templates/flight-agency-cancellation.template";


class BookingService {

    constructor() {
        this.registerHandlebarsHelpers();
    }

    private bookingRepo = new BookingRepository();
    private reviewDataService = new FlightReviewDataService();

    // ----------------------------
    // ---- PRIVATE FUNCTIONS -----
    // ------- BEGINS HERE --------
    // ----------------------------

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
        }
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
            if (!price) return '0.00';
            return `${price.toFixed(2)}`;
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

        Handlebars.registerHelper('add', function (a: number, b: number) {
            return a + b;
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

    private prepareTemplateData(tripjackData: any, dbData: any, booking: any) {
        const tripInfo = tripjackData?.itemInfos?.AIR?.TripInformation || [];
        const segments: any[] = [];

        const totalTrips = tripInfo.length;
        const isRoundTrip = totalTrips === 2;
        const isMultiCity = totalTrips > 2;
        const isOneWay = totalTrips === 1;

        for (let tripIndex = 0; tripIndex < tripInfo.length; tripIndex++) {
            const trip = tripInfo[tripIndex];
            const segmentInfo = trip.SegmentInformation || [];

            for (const segment of segmentInfo) {
                let baggageInfo = null;
                if (segment.BaggageInfo && segment.BaggageInfo.tI && segment.BaggageInfo.tI.length > 0) {
                    baggageInfo = segment.BaggageInfo.tI[0]?.FareDetails?.BaggageInfo || null;
                }

                segments.push({
                    departureAirport: segment.DepartureAirport,
                    arrivalAirport: segment.ArrivalAirport,
                    departureTime: segment.DepartureTime,
                    arrivalTime: segment.ArrivalTime,
                    flightDetails: {
                        AirlineInfo: segment.FlightDetails?.AirlineInfo || {},
                        FirstName: segment.FlightDetails?.FirstName || '',
                        EquipmentType: segment.FlightDetails?.EquipmentType || '',
                        FareBasis: segment.BaggageInfo?.tI?.[0]?.FareDetails?.FareBasis || '',
                        CabinClass: segment.BaggageInfo?.tI?.[0]?.FareDetails?.CabinClass || 'Economy'
                    },
                    duration: segment.Duration,
                    numberOfStops: segment.NumberOfStops,
                    baggageInfo: baggageInfo,
                    segmentNumber: segment.SegmentNumber,
                    tripIndex: tripIndex,
                    isFirstTrip: tripIndex === 0,
                    totalTrips: totalTrips
                });
            }
        }

        const travellers = tripjackData?.itemInfos?.AIR?.TravellerInformation || [];
        const formattedTravellers = travellers.map((traveller: any) => {
            let baggageInfo = null;
            let baseBaggage = null;

            if (traveller.FareDetails?.BaggageInfo) {
                baggageInfo = traveller.FareDetails.BaggageInfo;
                baseBaggage = baggageInfo.CheckInBaggage || baggageInfo.ClassCode || null;
            }

            let totalSeatCharge = 0;
            let totalMealCharge = 0;
            let totalBaggageCharge = 0;

            if (traveller.SSR_Seat_Information) {
                const seatKeys = Object.keys(traveller.SSR_Seat_Information);
                for (const key of seatKeys) {
                    totalSeatCharge += traveller.SSR_Seat_Information[key]?.Amount || 0;
                }
            }

            if (traveller.SSR_Meal_Information) {
                const mealKeys = Object.keys(traveller.SSR_Meal_Information);
                for (const key of mealKeys) {
                    totalMealCharge += traveller.SSR_Meal_Information[key]?.Amount || 0;
                }
            }

            let extraBaggageByTrip: { [key: number]: string[] } = {};
            if (traveller.SSR_Baggage_Information) {
                const baggageKeys = Object.keys(traveller.SSR_Baggage_Information);
                for (const key of baggageKeys) {
                    const baggage = traveller.SSR_Baggage_Information[key];
                    totalBaggageCharge += baggage?.Amount || 0;
                    if (baggage?.Description) {
                        const segment = segments.find((s: any) => {
                            const routeKey = `${s.departureAirport.SSRCode}-${s.arrivalAirport.SSRCode}`;
                            return routeKey === key;
                        });
                        const tripIndex = segment ? segment.tripIndex : 0;
                        if (!extraBaggageByTrip[tripIndex]) {
                            extraBaggageByTrip[tripIndex] = [];
                        }
                        if (!extraBaggageByTrip[tripIndex].includes(baggage.Description)) {
                            extraBaggageByTrip[tripIndex].push(baggage.Description);
                        }
                    }
                }
            }

            const extraBaggageDetails: string[] = [];
            const tripKeys = Object.keys(extraBaggageByTrip).map(Number).sort((a, b) => a - b);
            for (const tripIndex of tripKeys) {
                const descriptions = extraBaggageByTrip[tripIndex];
                if (descriptions && descriptions.length > 0) {
                    if (isRoundTrip) {
                        const label = tripIndex === 0 ? 'Onward' : 'Return';
                        extraBaggageDetails.push(`${label}: ${descriptions.join(', ')}`);
                    } else if (isMultiCity) {
                        extraBaggageDetails.push(`Journey ${tripIndex + 1}: ${descriptions.join(', ')}`);
                    } else {
                        extraBaggageDetails.push(descriptions.join(', '));
                    }
                }
            }

            const formattedPnrDetails: any[] = [];
            if (traveller.pnrDetails) {
                const pnrKeys = Object.keys(traveller.pnrDetails);
                for (const key of pnrKeys) {
                    const segment = segments.find((s: any) => {
                        const routeKey = `${s.departureAirport.SSRCode}-${s.arrivalAirport.SSRCode}`;
                        return routeKey === key;
                    });

                    if (segment) {
                        formattedPnrDetails.push({
                            pnr: traveller.pnrDetails[key],
                            route: `${segment.departureAirport.SSRCode} → ${segment.arrivalAirport.SSRCode}`,
                            flightNumber: `${segment.flightDetails.AirlineInfo.SSRCode} ${segment.flightDetails.FirstName}`,
                            departureCity: segment.departureAirport.city,
                            arrivalCity: segment.arrivalAirport.city
                        });
                    } else {
                        formattedPnrDetails.push({
                            pnr: traveller.pnrDetails[key],
                            route: key,
                            flightNumber: 'N/A',
                            departureCity: '',
                            arrivalCity: ''
                        });
                    }
                }
            }

            return {
                title: traveller.Title || '',
                firstName: traveller.FirstName || '',
                lastName: traveller.LastName || '',
                paxType: traveller.PaxType || '',
                dateOfBirth: traveller.DateOfBirth || '',
                seatInfo: traveller.SSR_Seat_Information || traveller.seatInfo || {},
                mealInfo: traveller.SSR_Meal_Information || traveller.mealInfo || {},
                baggageInfo: baggageInfo || {},
                baseBaggage: baseBaggage,
                extraBaggageDetails: extraBaggageDetails,
                pnrDetails: traveller.pnrDetails || traveller.gdsPnrs || {},
                formattedPnrDetails: formattedPnrDetails,
                passportNumber: traveller.PassportNumber || '',
                passportNationality: traveller.PassportNationality || '',
                passportIssueDate: traveller.PassportIssueDate || '',
                passportExpiryDate: traveller.PassportExpiryDate || '',
                mealCharge: totalMealCharge,
                baggageCharge: totalBaggageCharge,
                seatCharge: totalSeatCharge
            };
        });

        const gstInfo = tripjackData?.GSTInformation || booking?.gstInfo || null;
        const formattedGstInfo = gstInfo ? {
            gstNumber: gstInfo.GSTNumber || gstInfo.gstNumber || '',
            registeredName: gstInfo.RegisteredName || gstInfo.registeredName || '',
            email: gstInfo.email || '',
            mobile: gstInfo.mobile || '',
            address: gstInfo.address || '',
            isSez: gstInfo.isez || gstInfo.isSez || false
        } : null;

        const totalMeals = formattedTravellers.reduce((sum: number, t: any) => sum + (t.mealCharge || 0), 0);
        const totalBaggage = formattedTravellers.reduce((sum: number, t: any) => sum + (t.baggageCharge || 0), 0);
        const totalSeat = formattedTravellers.reduce((sum: number, t: any) => sum + (t.seatCharge || 0), 0);

        return {
            bookingId: tripjackData?.order?.BookingId || booking?.bookingId || '',
            ticketNumber: tripjackData?.order?.BookingId || booking?.bookingId || '',
            bookingDate: tripjackData?.order?.createdOn || new Date().toISOString(),
            status: tripjackData?.order?.status || '',
            totalAmount: tripjackData?.order?.Amount || 0,
            totalPrice: booking?.totalPrice || 0,
            markupPrice: booking?.markupPrice || 0,
            tripjackPrice: booking?.tripjackPrice || 0,
            travellers: formattedTravellers,
            segments: segments,
            deliveryInfo: tripjackData?.order?.DeliveryInformation || {},
            travellerEmail: booking?.email || '',
            agentEmail: dbData?.userInfo?.email || '',
            userInfo: dbData?.userInfo || {},
            isMultiCity: isMultiCity,
            isRoundTrip: isRoundTrip,
            isOneWay: isOneWay,
            gstInfo: formattedGstInfo,
            order: tripjackData?.order || {},
            totalMeals: totalMeals,
            totalBaggage: totalBaggage,
            totalSeat: totalSeat,
            taxBreakdown: [],
            airlineContact: '022 26168058',
            companyEmail: 'info.klarworld@gmail.com'
        };
    }

    private async processBookingAftermath(
        updatedBooking: any,
        bookingId: string
    ) {
        try {
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

            const html = flightConfirmationTemplate(tripjackBookingStatus);
            const subject = `Flight Booking Confirmation - ${updatedBooking.bookingId}`;

            if (travellerEmail) {
                await this.sendEmail(
                    travellerEmail,
                    subject,
                    html
                );
            }

            if (agentEmail && agentEmail !== travellerEmail) {
                await this.sendEmail(
                    agentEmail,
                    subject,
                    html
                );
            }
        } catch (error: any) {

        }
    }

    // ----------------------------
    // ---- PRIVATE FUNCTIONS -----
    // -------- ENDS HERE --------
    // ----------------------------



    public async sendBookingEmails(bookingId: string) {
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

            const templateData = this.prepareTemplateData(
                tripjackData,
                dbData,
                booking
            );

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

        } catch (error: any) {

        }
    }

    public async sendCancellationEmails(bookingId: string) {
        try {
            const booking = await this.bookingRepo.getBookingById(bookingId);
            if (!booking) return;

            const [tripjackData, dbData] = await Promise.all([
                TripjackBookingService.getBookingDetails(bookingId),
                this.getBookingDetails(bookingId),
            ]);

            if (!tripjackData) return;

            const travellerEmail = tripjackData?.order?.DeliveryInformation?.Emails?.[0] ||
                tripjackData?.order?.contactInfo?.emails?.[0] ||
                booking?.email || "";

            const agentEmail = dbData?.userInfo?.email || "";

            const travellers = tripjackData?.itemInfos?.AIR?.TravellerInformation || [];
            const formattedTravellers = travellers.map((t: any) => ({
                title: t.Title || '',
                firstName: t.FirstName || '',
                lastName: t.LastName || '',
                paxType: t.PaxType || '',
                dob: t.DateOfBirth || '',
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

            const templateData = {
                bookingId: tripjackData?.order?.BookingId || booking?.bookingId || '',
                bookingDate: tripjackData?.order?.createdOn || new Date().toISOString(),
                status: tripjackData?.order?.status || 'CANCELLED',
                totalPrice: booking?.totalPrice || 0,
                markupPrice: booking?.markupPrice || 0,
                tripjackPrice: booking?.tripjackPrice || 0,
                travellers: formattedTravellers,
                travellerEmail: booking?.email || '',
                agentEmail: dbData?.userInfo?.email || '',
                email: booking?.email || '',
                phone: booking?.phone || '',
                gstInfo: formattedGstInfo,
                userInfo: dbData?.userInfo || {},
                order: tripjackData?.order || {},
                cancellationDate: new Date().toISOString(),
            };

            const clientTemplate = Handlebars.compile(cancellationRequestTemplate, {
                strict: false,
                assumeObjects: true
            });

            const agencyTemplate = Handlebars.compile(cancellationRequestAgencyTemplate, {
                strict: false,
                assumeObjects: true
            });

            if (travellerEmail) {
                await this.sendEmail(
                    travellerEmail,
                    `Flight Cancellation Confirmation - ${bookingId}`,
                    clientTemplate(templateData)
                );
            }

            if (agentEmail && agentEmail !== travellerEmail) {
                await this.sendEmail(
                    agentEmail,
                    `Flight Cancellation Confirmation - ${bookingId} (Agency Copy)`,
                    agencyTemplate(templateData)
                );
            }

        } catch (error: any) {

        }
    }

    async createInitialBooking(data: Partial<Booking>, userData: any) {

        if (!data.bookingId) {
            throw new Error("bookingId is required");
        }

        if (!data.travellers || data.travellers.length === 0) {
            throw new Error("At least one traveller is required");
        }

        if (!data.departureDate) {
            throw new Error("Departure date is required");
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

        const userRole = Array.isArray(userData.roles)
            ? userData.roles[0] || ""
            : typeof userData.roles === "string"
            ? userData.roles
            : "";

        const userInfo = {
            id: userData.id,
            email: userData.email,
            role: userRole,
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
            departureDate: data.departureDate,
            ...(data.flightSegments && { flightSegments: data.flightSegments }),
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
                status: "INITIATED",
                departureDate: payload.departureDate
            };

            if (payload.flightSegments) {
                updateData.flightSegments = payload.flightSegments;
            }

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

        // ── Authoritative verification, before anything is claimed or sent ──
        //
        // Everything below this point treats the request body as untrusted.
        // The fare, the SSR prices and every conditional field requirement are
        // rebuilt from the Review that TripJack itself returned (C-1/C-4/H-4).
        const review = await this.loadReviewOrThrow(bookingId);
        const requirements = resolveBookingRequirements(review.mappedData);

        if (isReviewExpired(requirements, review.storedAt)) {
            throw new BookingVerificationError(
                "The reviewed fare has expired. Please search and review again.",
                "REVIEW_EXPIRED",
                409
            );
        }

        // H-5 — Hold is only offered when TripJack allows blocking for this
        // fare (conditions.isBA, Flights 1.8.2 p. 38).
        if (updatedBooking.isHold && !requirements.hold.allowed) {
            throw new BookingVerificationError(
                "This fare cannot be held. Please complete an instant booking instead.",
                "HOLD_NOT_ALLOWED"
            );
        }

        const seatMap = await this.loadSeatMap(bookingId, updatedBooking.travellers);

        // C-1 / H-4 — rebuild the payable amount from the Review plus
        // server-priced ancillaries and reject anything that disagrees.
        const verified = verifyBookingAmount({
            clientTripjackAmount: updatedBooking.tripjackPrice,
            review: review.mappedData,
            seatMap,
            travellers: updatedBooking.travellers || [],
        });

        const tripjackPayload: FrontendBookingPayload = {
            bookingId: updatedBooking.bookingId,
            email: updatedBooking.email,
            phone: updatedBooking.phone,
            travellers: updatedBooking.travellers,
            // The verified figure, never the client's.
            amount: verified.authoritativeAmount,
            isHold: updatedBooking.isHold,
            emergencyContact: updatedBooking.emergencyContact
        };

        if (updatedBooking.gstInfo?.gstNumber) {
            tripjackPayload.gstInfo = updatedBooking.gstInfo;
        }

        // C-4 / C-5 / H-6 / H-7 / H-8 — conditional field validation, server
        // side, driven by the same Review conditions the form was built from.
        validateBookingPayload(tripjackPayload, {
            requirements,
            departureDate: updatedBooking.departureDate,
        });

        // C-6 — claim the booking atomically. A concurrent duplicate, a retry
        // or a double-click finds the record already claimed and is refused
        // before any upstream call happens.
        const claimed = await this.bookingRepo.claimForBooking(bookingId);
        if (!claimed) {
            throw new BookingVerificationError(
                "This booking is already in progress or has already been completed.",
                "BOOKING_ALREADY_IN_PROGRESS",
                409
            );
        }

        const mapped = mapToTripjackBooking(tripjackPayload);

        let response: any;
        try {
            response = await TripjackBookingService.book(mapped);
        } catch (error: any) {
            const upstreamStatus = Number(error?.response?.status);
            if (upstreamStatus >= 400 && upstreamStatus < 500) {
                // TripJack answered and created nothing — safe to let the
                // customer correct the request and try again.
                await this.bookingRepo.releaseBookingClaim(bookingId, "INITIATED").catch(() => { });

                // A seat taken between review and ticketing lands here. Say so
                // explicitly so the agent re-picks a seat rather than guessing.
                const upfront = parseUpfrontSeatError(error?.response?.data);
                if (upfront) {
                    throw new BookingVerificationError(
                        upfront.userMessage,
                        "SEAT_SELECTION_MANDATORY",
                        400
                    );
                }
            } else {
                // Timeout or 5xx: the booking may exist upstream. Keep the
                // claim so a retry cannot create a second ticket, and leave it
                // for reconciliation.
                console.error("[Booking][INDETERMINATE] upstream outcome unknown >>>", {
                    bookingId,
                    message: error?.message,
                });
            }
            throw error;
        }

        // H-9 — record what TripJack actually said rather than collapsing
        // everything that is not an outright success into a null.
        const orderStatus = this.extractOrderStatus(response?.data);
        await this.bookingRepo
            .updateBookingStatus(bookingId, orderStatus)
            .catch(() => { });

        if (response?.data?.status?.success === true) {
            this.sendBookingEmails(bookingId);
            return response.data;
        }

        return null;
    }

    /**
     * Load the Review stored at review time, or refuse to book.
     *
     * Failing closed is deliberate: without the Review there is no authoritative
     * fare and no condition set, so proceeding would mean trusting the client
     * for both — exactly the hole C-1 closes.
     */
    private async loadReviewOrThrow(bookingId: string) {
        let review: any = null;
        try {
            review = await this.reviewDataService.getReviewDataByBookingId(bookingId);
        } catch {
            review = null;
        }

        if (!review?.mappedData) {
            throw new BookingVerificationError(
                "No reviewed fare is on record for this booking. Please review the itinerary again before booking.",
                "REVIEW_MISSING",
                409
            );
        }
        return review;
    }

    /**
     * Seat map for seat-SSR pricing, from cache, fetched once if absent.
     * Skipped entirely when no seats were selected.
     */
    private async loadSeatMap(bookingId: string, travellers: any[]): Promise<any> {
        const seatsSelected = (travellers || []).some(
            (t: any) => t?.ssrSeatInfos?.length
        );
        if (!seatsSelected) return null;

        try {
            const cached = await RedisCacheService.get(seatMapCacheKey(bookingId));
            if (cached) return cached;
        } catch {
            // fall through to a fresh fetch
        }

        const fresh = await SeatService.getSeats(bookingId);
        return fresh?.data ?? null;
    }

    /**
     * Map a TripJack booking response onto our local status (H-9).
     *
     * All seven documented order statuses are represented (Flights 1.8.2
     * pp. 62-63). PENDING and ABORTED in particular must stay distinct from
     * FAILED — money may have moved and they need reconciliation, not a retry.
     */
    private extractOrderStatus(data: any): Booking["status"] {
        const upstream = String(
            data?.order?.status ?? data?.status?.order ?? ""
        ).toUpperCase();

        switch (upstream) {
            case "SUCCESS":
            case "ON_HOLD":
            case "CANCELLED":
            case "FAILED":
            case "PENDING":
            case "ABORTED":
            case "UNCONFIRMED":
                return upstream as Booking["status"];
            default:
                break;
        }

        // No order status in the response: fall back to the call's own success
        // flag. An unrecognised outcome is PENDING, not FAILED — it must be
        // reconciled rather than silently retried.
        if (data?.status?.success === true) return "SUCCESS";
        return "PENDING";
    }

    async getBookingsByUserId(userId: string, filter?: string) {
        if (!userId) {
            throw new Error("userId is required");
        }

        return await this.bookingRepo.getBookingsByUserId(userId);
    }

    async getBookingsByUserIdPaginated(
        userId: string,
        page: number = 1,
        limit: number = 10,
        filter?: string
    ) {
        if (!userId) {
            throw new Error("userId is required");
        }

        const skip = (page - 1) * limit;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        let query: any = {
            "userInfo.id": userId
        };

        if (filter === 'cancelled') {
            query.status = { $in: ['CANCELLED', 'CANCEL_REQUESTED'] };
            const [bookings, total] = await Promise.all([
                this.bookingRepo.getBookingsByUserIdPaginated(query, skip, limit),
                this.bookingRepo.countBookings(query)
            ]);
            return {
                data: bookings,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: page < Math.ceil(total / limit),
                    hasPrevPage: page > 1
                }
            };
        }

        const bookings = await this.bookingRepo.getBookingsByUserId(userId);

        let filteredBookings = bookings;

        if (filter === 'upcoming') {
            filteredBookings = bookings.filter((b: any) => {
                if (b.status === 'CANCELLED' || b.status === 'CANCEL_REQUESTED') return false;
                if (!b.departureDate) return true;
                const parts = b.departureDate.split('/');
                if (parts.length !== 3) return true;
                const dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                return dateStr >= todayStr;
            });
        } else if (filter === 'past') {
            filteredBookings = bookings.filter((b: any) => {
                if (b.status === 'CANCELLED' || b.status === 'CANCEL_REQUESTED') return false;
                if (!b.departureDate) return true;
                const parts = b.departureDate.split('/');
                if (parts.length !== 3) return true;
                const dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                return dateStr < todayStr;
            });
        }

        const total = filteredBookings.length;
        const paginatedBookings = filteredBookings.slice(skip, skip + limit);

        return {
            data: paginatedBookings,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        };
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

    async processBookingAftermathById(bookingId: string) {
        try {
            const booking = await this.bookingRepo.getBookingById(bookingId);
            if (!booking) {
                throw new Error("Booking not found");
            }

            const [tripjackBookingStatus, ownDatabaseBookingStatus] = await Promise.all([
                TripjackBookingService.getBookingDetails(bookingId),
                this.getBookingDetails(bookingId),
            ]);

            if (!tripjackBookingStatus) {
                throw new Error("Failed to get booking details from Tripjack");
            }

            const travellerEmail = tripjackBookingStatus?.order?.DeliveryInformation?.Emails?.[0] ||
                tripjackBookingStatus?.order?.contactInfo?.emails?.[0] ||
                booking?.email || "";

            const agentEmail = ownDatabaseBookingStatus?.userInfo?.email || "";

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
                return `${price.toFixed(2)}`;
            });

            Handlebars.registerHelper('getAirlineName', function (airlineInfo: any) {
                return airlineInfo?.AirlineName || 'N/A';
            });

            Handlebars.registerHelper('getFlightNumber', function (flightDetails: any) {
                return flightDetails?.FirstName || 'N/A';
            });

            const templateData = this.prepareTemplateData(
                tripjackBookingStatus,
                ownDatabaseBookingStatus,
                booking
            );

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
            }

            if (agentEmail && agentEmail !== travellerEmail) {
                const agencyHtml = agencyTemplate(templateData);
                await this.sendEmail(
                    agentEmail,
                    `Flight Booking Confirmation - ${bookingId} (Agency Copy)`,
                    agencyHtml
                );
            }

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

            return {
                success: false,
                bookingId,
                error: error.message
            };
        }
    }

}

export default new BookingService();