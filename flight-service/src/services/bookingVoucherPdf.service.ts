import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { registerHandlebarsHelpers } from '../utils/helper/handlebars.helpers';
import { bookingVoucherTemplate } from '../templates/bookingVoucherPdf.template';

export class BookingVoucherPdfService {
    /**
     * Generate PDF from HTML template
     */
    static async generatePDF(htmlContent: string, options?: {
        format?: 'A4' | 'Letter' | 'Legal';
        landscape?: boolean;
        margin?: { top?: string; right?: string; bottom?: string; left?: string };
    }): Promise<Buffer> {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();

            await page.setContent(htmlContent, {
                waitUntil: 'load'
            });

            const pdfBuffer = await page.pdf({
                format: options?.format || 'A4',
                landscape: options?.landscape || false,
                margin: options?.margin || {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                },
                printBackground: true,
                preferCSSPageSize: true
            });

            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }

    /**
     * Generate flight voucher PDF
     */
    static async generateFlightVoucherPDF(
        bookingResponse: any, // Tripjack response
        localBookingData: any, // Local booking data
        logoBase64?: string
    ): Promise<Buffer> {
        registerHandlebarsHelpers();
        const compiledTemplate = Handlebars.compile(bookingVoucherTemplate);

        // Load logo if not provided
        if (!logoBase64) {
            try {
                const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png');
                const logoBuffer = await fs.readFile(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } catch (error) {

            }
        }

        // Log the incoming data for debugging



        
        // The response from Tripjack comes in a specific structure
        // Based on your Book response, the data is in bookingResponse.data
        const responseData = bookingResponse?.data || bookingResponse || {};
        const order = responseData.order || {};
        const itemInfos = responseData.itemInfos?.AIR || {};
        



        // Extract data with proper fallbacks
        const travellerInfo = itemInfos.TravellerInformation || [];
        const tripInformation = itemInfos.TripInformation || [];
        const totalPriceInfo = itemInfos.totalPriceInfo || {};
        const deliveryInfo = order.DeliveryInformation || {};
        const emergencyContactInfo = order.EmergencyContactInformation || {};



        // Prepare flight segments
        const flightSegments: any[] = [];
        
        tripInformation.forEach((trip: any) => {
            const segmentInfo = trip.SegmentInformation || [];
            segmentInfo.forEach((segment: any) => {
                const flightDetails = segment.FlightDetails || {};
                const departureAirport = segment.DepartureAirport || {};
                const arrivalAirport = segment.ArrivalAirport || {};
                const baggageInfo = segment.BaggageInfo || {};
                
                // Get fare details from the first traveller or from baggage info
                let fareDetails = baggageInfo?.tI?.[0]?.FareDetails || {};
                let baggageDetails = fareDetails.BaggageInfo || {};
                
                // If no fare details in baggage, try to get from traveller info
                if (Object.keys(fareDetails).length === 0 && travellerInfo.length > 0) {
                    const firstTraveller = travellerInfo[0];
                    if (firstTraveller && firstTraveller.FareDetails) {
                        fareDetails = firstTraveller.FareDetails || {};
                        baggageDetails = fareDetails.BaggageInfo || {};
                    }
                }
                
                flightSegments.push({
                    segmentId: segment.SegmentID || 'N/A',
                    airline: flightDetails.AirlineInfo?.AirlineName || 'N/A',
                    airlineCode: flightDetails.AirlineInfo?.SSRCode || 'N/A',
                    flightNumber: flightDetails.FirstName || 'N/A',
                    equipment: flightDetails.EquipmentType || 'N/A',
                    isLowCostCarrier: flightDetails.AirlineInfo?.IsLowCostCarrier || false,
                    numberOfStops: segment.NumberOfStops || 0,
                    duration: segment.Duration || 0,
                    departure: {
                        airportCode: departureAirport.SSRCode || 'N/A',
                        airportName: departureAirport.AirlineName || 'N/A',
                        city: departureAirport.city || 'N/A',
                        country: departureAirport.country || 'N/A',
                        terminal: departureAirport.terminal || 'N/A',
                        time: segment.DepartureTime || 'N/A',
                        date: segment.DepartureTime ? new Date(segment.DepartureTime) : null
                    },
                    arrival: {
                        airportCode: arrivalAirport.SSRCode || 'N/A',
                        airportName: arrivalAirport.AirlineName || 'N/A',
                        city: arrivalAirport.city || 'N/A',
                        country: arrivalAirport.country || 'N/A',
                        terminal: arrivalAirport.terminal || 'N/A',
                        time: segment.ArrivalTime || 'N/A',
                        date: segment.ArrivalTime ? new Date(segment.ArrivalTime) : null
                    },
                    isInternational: segment.IsInternationalAndDomestic || false,
                    isRefundable: segment.IsRefundableSegment || false,
                    baggageInfo: {
                        checkIn: baggageDetails.CheckInBaggage || 'N/A',
                        cabin: baggageDetails.ClassCode || 'N/A',
                        mealIncluded: fareDetails.MealIncluded || false,
                        cabinClass: fareDetails.CabinClass || 'ECONOMY',
                        classCode: fareDetails.ClassCode || 'N/A'
                    }
                });
            });
        });



        // Prepare traveller information with SSR details
        const travellers = travellerInfo.map((traveller: any, index: number) => {
            const fareDetails = traveller.FareDetails || {};
            const baggageInfo = fareDetails.BaggageInfo || {};
            
            // Extract SSR details
            const seatInfo = traveller.SSR_Seat_Information || {};
            const mealInfo = traveller.SSR_Meal_Information || {};
            const baggageExtraInfo = traveller.SSR_Baggage_Information || {};
            
            // Get seat details
            let seatNumber = 'N/A';
            let seatPosition = '';
            const seatKeys = Object.keys(seatInfo);
            if (seatKeys.length > 0) {
                const firstSeatKey = seatKeys[0];
                const seat = seatInfo[firstSeatKey];
                if (seat) {
                    seatNumber = seat.seatNo || 'N/A';
                    if (seat.seatPosition) {
                        seatPosition = `Row ${seat.seatPosition.row || ''}${seat.seatPosition.column ? ', Seat ' + seat.seatPosition.column : ''}`;
                    }
                }
            }
            
            // Get meal details
            let mealDescription = 'N/A';
            const mealKeys = Object.keys(mealInfo);
            if (mealKeys.length > 0) {
                const firstMealKey = mealKeys[0];
                const meal = mealInfo[firstMealKey];
                if (meal) {
                    mealDescription = meal.Description || 'N/A';
                }
            }
            
            // Get extra baggage details
            let extraBaggage = 'N/A';
            const baggageKeys = Object.keys(baggageExtraInfo);
            if (baggageKeys.length > 0) {
                const firstBaggageKey = baggageKeys[0];
                const baggage = baggageExtraInfo[firstBaggageKey];
                if (baggage) {
                    extraBaggage = baggage.Description || 'N/A';
                }
            }
            
            return {
                title: traveller.Title || 'Mr',
                firstName: traveller.FirstName || 'N/A',
                lastName: traveller.LastName || 'N/A',
                fullName: `${traveller.Title || 'Mr'} ${traveller.FirstName || ''} ${traveller.LastName || ''}`.trim(),
                paxType: traveller.PaxType || 'ADULT',
                dateOfBirth: traveller.DateOfBirth || 'N/A',
                cabinClass: fareDetails.CabinClass || 'ECONOMY',
                classCode: fareDetails.ClassCode || 'N/A',
                fareBasis: fareDetails.FareBasis || 'N/A',
                checkInBaggage: baggageInfo.CheckInBaggage || 'N/A',
                cabinBaggage: baggageInfo.ClassCode || 'N/A',
                seatNumber: seatNumber,
                seatPosition: seatPosition,
                mealDescription: mealDescription,
                extraBaggage: extraBaggage,
                mealIncluded: fareDetails.MealIncluded || false
            };
        });



        // Calculate totals
        const fareComponents = totalPriceInfo.totalFareDetail?.FareComponents || {};
        const additionalFareComponents = totalPriceInfo.totalFareDetail?.AdditionalFareComponents || {};
        const totalAdditionalFare = additionalFareComponents.TotalAdditionalFare || {};
        
        const priceBreakdown = {
            baseFare: fareComponents.BaseFare || 0,
            totalAdditionalFare: fareComponents.TotalAdditionalFare || 0,
            ssrp: fareComponents.SSRP || 0,
            igst: fareComponents.IGST || 0,
            totalFare: fareComponents.TotalFare || 0,
            managementFee: totalAdditionalFare.ManagementFee || 0,
            managementFeeTax: totalAdditionalFare.ManagementFeeTax || 0,
            otherTaxes: totalAdditionalFare.OtherTaxes || 0,
            fuelSurcharge: totalAdditionalFare.FuelSurcharge || 0,
            airlineGST: totalAdditionalFare.AirlineGSTComponent || 0
        };



        // Get primary traveller
        const primaryTraveller = travellers.length > 0 ? travellers[0] : null;

        // Get PNR details from traveller info
        const pnrDetails: any[] = [];
        travellerInfo.forEach((traveller: any) => {
            const pnr = traveller.pnrDetails || {};
            Object.keys(pnr).forEach((segment) => {
                pnrDetails.push({
                    segment: segment,
                    pnr: pnr[segment] || 'N/A'
                });
            });
        });

        // Prepare SSR Info for summary
        const ssrInfo: any = {};
        travellerInfo.forEach((traveller: any) => {
            const travellerName = `${traveller.Title || 'Mr'} ${traveller.FirstName || ''} ${traveller.LastName || ''}`.trim();
            const seatInfo = traveller.SSR_Seat_Information || {};
            const mealInfo = traveller.SSR_Meal_Information || {};
            const baggageExtraInfo = traveller.SSR_Baggage_Information || {};
            
            const seats: any[] = [];
            Object.keys(seatInfo).forEach((key) => {
                const seat = seatInfo[key];
                if (seat) {
                    seats.push({
                        segment: key,
                        seatNumber: seat.seatNo || 'N/A',
                        amount: seat.Amount || 0,
                        isLegroom: seat.isLegroom || false,
                        isAisle: seat.isAisle || false
                    });
                }
            });
            
            const meals: any[] = [];
            Object.keys(mealInfo).forEach((key) => {
                const meal = mealInfo[key];
                if (meal) {
                    meals.push({
                        segment: key,
                        code: meal.SSRCode || 'N/A',
                        description: meal.Description || 'N/A',
                        amount: meal.Amount || 0
                    });
                }
            });
            
            const baggageItems: any[] = [];
            Object.keys(baggageExtraInfo).forEach((key) => {
                const baggage = baggageExtraInfo[key];
                if (baggage) {
                    baggageItems.push({
                        segment: key,
                        code: baggage.SSRCode || 'N/A',
                        description: baggage.Description || 'N/A',
                        amount: baggage.Amount || 0
                    });
                }
            });
            
            if (seats.length > 0 || meals.length > 0 || baggageItems.length > 0) {
                ssrInfo[travellerName] = {
                    travellerName,
                    seats: seats.length > 0 ? seats : undefined,
                    meals: meals.length > 0 ? meals : undefined,
                    baggage: baggageItems.length > 0 ? baggageItems : undefined
                };
            }
        });

        // Calculate total price
        const totalPrice = localBookingData.totalPrice || 
                          priceBreakdown.totalFare || 
                          order.Amount || 
                          fareComponents.TotalFare || 0;

        // Prepare template data
        const templateData = {
            // Booking Information
            bookingId: localBookingData.bookingId || order.BookingId || 'N/A',
            supplierReference: order.BookingId || localBookingData.bookingId || 'N/A',
            bookingStatus: localBookingData.status || order.status || 'N/A',
            createdOn: order.createdOn || localBookingData.createdAt || 'N/A',
            issueDate: new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            
            // Guest Information
            primaryGuest: primaryTraveller ? primaryTraveller.fullName : 'N/A',
            email: localBookingData.email || deliveryInfo.Emails?.[0] || 'N/A',
            phone: localBookingData.phone || deliveryInfo.Contacts?.[0] || 'N/A',
            employeeId: localBookingData.userInfo?.id || 'N/A',
            userType: localBookingData.userInfo?.clientType || localBookingData.userInfo?.role || 'N/A',
            
            // Supplier Information
            supplierName: 'Tripjack',
            supplierType: 'Direct API',
            emergencyHelpdesk: '+1 (800) 555-0199',
            
            // Emergency Contact
            emergencyContact: {
                name: localBookingData.emergencyContact?.name || 
                      emergencyContactInfo.EmergencyContactName || 'N/A',
                email: localBookingData.emergencyContact?.email || 
                       emergencyContactInfo.Emails?.[0] || 'N/A',
                phone: localBookingData.emergencyContact?.phone || 
                       emergencyContactInfo.Contacts?.[0] || 'N/A'
            },
            
            // Flight Segments
            flightSegments: flightSegments || [],
            
            // Travellers
            travellers: travellers || [],
            primaryTraveller: primaryTraveller,
            
            // PNR Details
            pnrDetails: pnrDetails || [],
            
            // SSR Info
            ssrInfo: ssrInfo || {},
            
            // SSR Flags
            hasSeat: primaryTraveller?.seatNumber && primaryTraveller.seatNumber !== 'N/A',
            hasMeal: primaryTraveller?.mealDescription && primaryTraveller.mealDescription !== 'N/A',
            hasExtraBaggage: primaryTraveller?.extraBaggage && primaryTraveller.extraBaggage !== 'N/A',
            
            // Price Breakdown
            priceBreakdown: priceBreakdown || {},
            
            // Local Booking Additional Info
            localBooking: {
                amount: localBookingData.amount || 0,
                isHold: localBookingData.isHold || false,
                tripjackPrice: localBookingData.tripjackPrice || 0,
                markupPrice: localBookingData.markupPrice || 0,
                totalPrice: totalPrice,
                markupPercentage: localBookingData.markupPrice && localBookingData.tripjackPrice ? 
                    ((localBookingData.markupPrice / localBookingData.tripjackPrice) * 100).toFixed(2) : '0'
            },
            
            // Total Price
            totalPrice: totalPrice,
            tripjackPrice: localBookingData.tripjackPrice || priceBreakdown.totalFare || 0,
            markupPrice: localBookingData.markupPrice || 0,
            
            // Logo
            logoBase64: logoBase64 || '',
            
            // Generated Date
            generatedDate: new Date().toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            
            // Current Year
            currentYear: new Date().getFullYear()
        };

        // Log final data for debugging









        const htmlContent = compiledTemplate(templateData);

        return await this.generatePDF(htmlContent, {
            format: 'A4',
            landscape: false,
            margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }
        });
    }
}