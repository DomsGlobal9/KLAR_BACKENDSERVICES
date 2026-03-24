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

    ssrSelections?: {
        baggage?: Array<{ segmentId: string; code: string }>;
        meal?: Array<{ segmentId: string; code: string }>;
        seat?: Array<{ segmentId: string; code: string }>;
    };
}

export class BookingMapper {

    /**
     * Convert user-friendly booking request to TripJack API format
     */
    static toTripJackFormat(userRequest: UserFriendlyBookingRequest): InstantBookingRequest {
        // First, create base traveller info without SSR selections from global ssrSelections
        const travellerInfo: TravellerInfo[] = userRequest.travellers.map((t) => {
            const traveller: TravellerInfo = {
                ti: t.title,
                pt: this.mapPaxType(t.type),
                fN: t.firstName,
                lN: t.lastName,
            };

            // Add optional fields if present
            if (t.dateOfBirth) {
                traveller.dob = t.dateOfBirth;
            }

            if (t.passportNumber) traveller.pNum = t.passportNumber;
            if (t.passportExpiryDate) traveller.eD = t.passportExpiryDate;
            if (t.passportNationality) traveller.pNat = t.passportNationality;
            if (t.passportIssueDate) traveller.pid = t.passportIssueDate;
            if (t.documentId) traveller.di = t.documentId;

            // Add traveller-specific SSR selections if present
            if (t.ssrSelections) {
                if (t.ssrSelections.baggage?.length) {
                    traveller.ssrBaggageInfos = t.ssrSelections.baggage.map(b => ({
                        key: b.segmentId,
                        code: b.code
                    }));
                }
                if (t.ssrSelections.meal?.length) {
                    traveller.ssrMealInfos = t.ssrSelections.meal.map(m => ({
                        key: m.segmentId,
                        code: m.code
                    }));
                }
                if (t.ssrSelections.seat?.length) {
                    traveller.ssrSeatInfos = t.ssrSelections.seat.map(s => ({
                        key: s.segmentId,
                        code: s.code
                    }));
                }
            }

            return traveller;
        });

        // Then, add global SSR selections (with travellerIndex) if present
        if (userRequest.ssrSelections) {
            // Process baggage selections
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

            // Process meal selections
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

            // Process seat selections
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

        // Build the complete booking request
        const bookingRequest: InstantBookingRequest = {
            bookingId: userRequest.bookingId,
            paymentInfos: [{ amount: userRequest.totalAmount }],
            deliveryInfo: {
                emails: [userRequest.deliveryEmail],
                contacts: [userRequest.deliveryPhone]
            },
            travellerInfo
        };

        // Add emergency contact if provided
        if (userRequest.emergencyContact) {
            bookingRequest.contactInfo = {
                emails: [userRequest.emergencyContact.email],
                contacts: [userRequest.emergencyContact.phone],
                ecn: userRequest.emergencyContact.name
            };
        }

        // Add GST info if provided
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