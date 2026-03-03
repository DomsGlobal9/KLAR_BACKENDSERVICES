import { ContactInfo, DeliveryInfo, GSTInfo, PaymentInfo, TravellerInfo } from "./booking.interface";


export interface StoreUserDetailsRequest {
    priceId: string;
    bookingDetails: {
        paymentInfos: PaymentInfo[];
        travellerInfo: TravellerInfo[];
        deliveryInfo: DeliveryInfo;
        contactInfo?: ContactInfo;
        gstInfo?: GSTInfo;
    };
}

export interface StoreUserDetailsResponse {
    success: boolean;
    message: string;
    data?: {
        priceId: string;
        status: string;
    };
}

export interface UpdateBookingIdRequest {
    priceId: string;
    bookingId: string;
    thirdPartyResponse?: any;
}

export interface GetBookingStatusResponse {
    success: boolean;
    message: string;
    data?: {
        priceId: string;
        bookingId?: string;
        status: string;
        userDetails?: {
            paymentInfos: PaymentInfo[];
            travellerInfo: TravellerInfo[];
            deliveryInfo: DeliveryInfo;
            contactInfo?: ContactInfo;
            gstInfo?: GSTInfo;
        };
        createdAt: Date;
        updatedAt: Date;
    };
}