import {
    InstantBookingRequest,
    TravellerInfo,
    DeliveryInfo,
    ContactInfo,
    GSTInfo,
    Title,
    PaxType,
    SSRInfo
} from "../../interface/flight/booking.interface";

export interface UserFriendlyBookingRequest {
    bookingId: string;
    totalAmount: number;
    deliveryEmail: string;
    deliveryPhone: string;

    emergencyContact?: {
        name: string;
        email: string;
        phone: string;
    };

    gst?: {
        number: string;
        registeredName: string;
        email?: string;
        phone?: string;
        address?: string;
    };

    travellers: UserFriendlyTraveller[];

    ssrSelections?: {
        baggage?: Array<{
            travellerIndex: number;
            segmentId: string;
            code: string;
        }>;
        meal?: Array<{
            travellerIndex: number;
            segmentId: string;
            code: string;
        }>;
        seat?: Array<{
            travellerIndex: number;
            segmentId: string;
            code: string;
        }>;
    };
}

export interface UserFriendlyTraveller {
    type: 'adult' | 'child' | 'infant';
    title: 'Mr' | 'Mrs' | 'Ms' | 'Master';
    firstName: string;
    lastName: string;
    dateOfBirth?: string;

    passportNumber?: string;
    passportExpiryDate?: string;
    passportNationality?: string;
    passportIssueDate?: string;

    documentId?: string;

    ssrSeatInfos?: Array<{ key: string; code: string }>;
    ssrBaggageInfos?: Array<{ key: string; code: string }>;
    ssrMealInfos?: Array<{ key: string; code: string }>;

    ssrSelections?: {
        baggage?: Array<{ segmentId: string; code: string }>;
        meal?: Array<{ segmentId: string; code: string }>;
        seat?: Array<{ segmentId: string; code: string }>;
    };
}

export class BookingMapper {

    /**
     * Convert user-friendly booking request to TripJack API format
     * Handles both new and old data formats
     */
    static toTripJackFormat(userRequest: UserFriendlyBookingRequest): InstantBookingRequest {
        const travellerInfo: TravellerInfo[] = userRequest.travellers.map((traveller, index) => {
            const travellerInfoObj: TravellerInfo = {
                ti: traveller.title,
                pt: this.mapPaxType(traveller.type),
                fN: traveller.firstName,
                lN: traveller.lastName,
            };

            if (traveller.dateOfBirth) {
                travellerInfoObj.dob = traveller.dateOfBirth;
            }

            if (traveller.passportNumber) travellerInfoObj.pNum = traveller.passportNumber;
            if (traveller.passportExpiryDate) travellerInfoObj.eD = traveller.passportExpiryDate;
            if (traveller.passportNationality) travellerInfoObj.pNat = traveller.passportNationality;
            if (traveller.passportIssueDate) travellerInfoObj.pid = traveller.passportIssueDate;
            if (traveller.documentId) travellerInfoObj.di = traveller.documentId;

            if (traveller.ssrSeatInfos && traveller.ssrSeatInfos.length > 0) {
                travellerInfoObj.ssrSeatInfos = traveller.ssrSeatInfos.map(seat => ({
                    key: seat.key,
                    code: seat.code
                }));
            }

            if (traveller.ssrBaggageInfos && traveller.ssrBaggageInfos.length > 0) {
                travellerInfoObj.ssrBaggageInfos = traveller.ssrBaggageInfos.map(baggage => ({
                    key: baggage.key,
                    code: baggage.code
                }));
            }

            if (traveller.ssrMealInfos && traveller.ssrMealInfos.length > 0) {
                travellerInfoObj.ssrMealInfos = traveller.ssrMealInfos.map(meal => ({
                    key: meal.key,
                    code: meal.code
                }));
            }

            if (traveller.ssrSelections) {
                if (traveller.ssrSelections.baggage?.length) {
                    if (!travellerInfoObj.ssrBaggageInfos) {
                        travellerInfoObj.ssrBaggageInfos = [];
                    }
                    traveller.ssrSelections.baggage.forEach(b => {
                        travellerInfoObj.ssrBaggageInfos!.push({
                            key: b.segmentId,
                            code: b.code
                        });
                    });
                }

                if (traveller.ssrSelections.meal?.length) {
                    if (!travellerInfoObj.ssrMealInfos) {
                        travellerInfoObj.ssrMealInfos = [];
                    }
                    traveller.ssrSelections.meal.forEach(m => {
                        travellerInfoObj.ssrMealInfos!.push({
                            key: m.segmentId,
                            code: m.code
                        });
                    });
                }


                if (traveller.ssrSelections.seat?.length) {
                    if (!travellerInfoObj.ssrSeatInfos) {
                        travellerInfoObj.ssrSeatInfos = [];
                    }
                    traveller.ssrSelections.seat.forEach(s => {
                        travellerInfoObj.ssrSeatInfos!.push({
                            key: s.segmentId,
                            code: s.code
                        });
                    });
                }
            }

            return travellerInfoObj;
        });

        if (userRequest.ssrSelections) {

            if (userRequest.ssrSelections.baggage) {
                userRequest.ssrSelections.baggage.forEach(selection => {
                    const traveller = travellerInfo[selection.travellerIndex];
                    if (traveller) {
                        if (!traveller.ssrBaggageInfos) {
                            traveller.ssrBaggageInfos = [];
                        }
                        traveller.ssrBaggageInfos.push({
                            key: selection.segmentId,
                            code: selection.code
                        });
                    }
                });
            }

            if (userRequest.ssrSelections.meal) {
                userRequest.ssrSelections.meal.forEach(selection => {
                    const traveller = travellerInfo[selection.travellerIndex];
                    if (traveller) {
                        if (!traveller.ssrMealInfos) {
                            traveller.ssrMealInfos = [];
                        }
                        traveller.ssrMealInfos.push({
                            key: selection.segmentId,
                            code: selection.code
                        });
                    }
                });
            }

            if (userRequest.ssrSelections.seat) {
                userRequest.ssrSelections.seat.forEach(selection => {
                    const traveller = travellerInfo[selection.travellerIndex];
                    if (traveller) {
                        if (!traveller.ssrSeatInfos) {
                            traveller.ssrSeatInfos = [];
                        }
                        traveller.ssrSeatInfos.push({
                            key: selection.segmentId,
                            code: selection.code
                        });
                    }
                });
            }
        }

        const bookingRequest: InstantBookingRequest = {
            bookingId: userRequest.bookingId,
            paymentInfos: [{ amount: userRequest.totalAmount }],
            deliveryInfo: {
                emails: [userRequest.deliveryEmail],
                contacts: [userRequest.deliveryPhone]
            },
            travellerInfo
        };

        if (userRequest.emergencyContact) {
            bookingRequest.contactInfo = {
                emails: [userRequest.emergencyContact.email],
                contacts: [userRequest.emergencyContact.phone],
                ecn: userRequest.emergencyContact.name
            };
        }

        if (userRequest.gst) {
            bookingRequest.gstInfo = {
                gstNumber: userRequest.gst.number,
                registeredName: userRequest.gst.registeredName,
                email: userRequest.gst.email,
                mobile: userRequest.gst.phone,
                address: userRequest.gst.address
            };
        }

        return bookingRequest;
    }

    /**
     * Map user-friendly pax type to TripJack format
     */
    private static mapPaxType(type: 'adult' | 'child' | 'infant'): PaxType {
        const map = {
            'adult': 'ADULT',
            'child': 'CHILD',
            'infant': 'INFANT'
        };
        return map[type] as PaxType;
    }
}