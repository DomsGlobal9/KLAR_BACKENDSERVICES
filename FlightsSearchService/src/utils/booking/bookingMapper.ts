import {
    InstantBookingRequest,
    TravellerInfo,
    DeliveryInfo,
    ContactInfo,
    GSTInfo,
    Title,
    PaxType
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
        baggage?: Array<{ segmentId: string; code: string }>;
        meal?: Array<{ segmentId: string; code: string }>;
        seat?: Array<{ segmentId: string; code: string }>;
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
}

export class BookingMapper {

    /**
     * Convert user-friendly booking request to TripJack API format
     */
    static toTripJackFormat(userRequest: UserFriendlyBookingRequest): InstantBookingRequest {


        const travellerInfo: TravellerInfo[] = userRequest.travellers.map(t => {
            const traveller: TravellerInfo = {
                ti: t.title,
                pt: this.mapPaxType(t.type),
                fN: t.firstName,
                lN: t.lastName,
            };


            if (t.dateOfBirth) {
                traveller.dob = t.dateOfBirth;
            }


            if (t.passportNumber) traveller.pNum = t.passportNumber;
            if (t.passportExpiryDate) traveller.eD = t.passportExpiryDate;
            if (t.passportNationality) traveller.pNat = t.passportNationality;
            if (t.passportIssueDate) traveller.pid = t.passportIssueDate;
            if (t.documentId) traveller.di = t.documentId;

            return traveller;
        });


        if (userRequest.ssrSelections) {
            travellerInfo.forEach((traveller, index) => {

                if (userRequest.ssrSelections?.baggage) {
                    traveller.ssrBaggageInfos = userRequest.ssrSelections.baggage.map(b => ({
                        key: b.segmentId,
                        code: b.code
                    }));
                }
                if (userRequest.ssrSelections?.meal) {
                    traveller.ssrMealInfos = userRequest.ssrSelections.meal.map(m => ({
                        key: m.segmentId,
                        code: m.code
                    }));
                }
                if (userRequest.ssrSelections?.seat) {
                    traveller.ssrSeatInfos = userRequest.ssrSelections.seat.map(s => ({
                        key: s.segmentId,
                        code: s.code
                    }));
                }
            });
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

    /**
     * Create a simple example request for users to understand
     */
    static getExampleRequest(): UserFriendlyBookingRequest {
        return {
            bookingId: "TJSO107900001801",
            totalAmount: 15172,
            deliveryEmail: "customer@example.com",
            deliveryPhone: "+919876543210",
            emergencyContact: {
                name: "Emergency Contact",
                email: "emergency@example.com",
                phone: "+919876543210"
            },
            gst: {
                number: "27AAPFU0939F1Z5",
                registeredName: "Customer Company Pvt Ltd",
                email: "billing@example.com",
                phone: "+919876543210",
                address: "Customer Address, City - 400001"
            },
            travellers: [
                {
                    type: 'adult',
                    title: 'Mr',
                    firstName: 'John',
                    lastName: 'Doe',
                    dateOfBirth: '1990-01-01',
                    passportNumber: 'A1234567',
                    passportExpiryDate: '2030-12-31',
                    passportNationality: 'IN',
                    passportIssueDate: '2020-01-01'
                },
                {
                    type: 'child',
                    title: 'Master',
                    firstName: 'Jane',
                    lastName: 'Doe',
                    dateOfBirth: '2018-05-15'
                },
                {
                    type: 'infant',
                    title: 'Master',
                    firstName: 'Baby',
                    lastName: 'Doe',
                    dateOfBirth: '2024-01-01'
                }
            ]
        };
    }
}