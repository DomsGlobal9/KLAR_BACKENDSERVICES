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
            this.sendBookingEmails(bookingId);
            return response.data;
        } else {
            return null;
        }
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