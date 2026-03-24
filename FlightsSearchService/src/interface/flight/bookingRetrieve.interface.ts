export interface BookingRetrieveRequest {
    bookingId: string;
    requirePaxPricing: boolean;
}

export interface BookingRetrieveResponse {
    order: {
        bookingId: string;
        amount: number;
        markup: number;
        deliveryInfo: {
            emails: string[];
            contacts: string[];
        };
        status: string;
        createdOn: string;
        isPassportConsentTaken: boolean;
    };
    itemInfos: {
        AIR: {
            tripInfos: any[];
            travellerInfos?: any[];
            totalPriceInfo?: {
                totalFareDetail: {
                    fC: any;
                    afC: any;
                };
            };
            irtara: boolean;
        };
    };
    gstInfo: {
        isez: boolean;
    };
    isSotoBooking: boolean;
    status: {
        success: boolean;
        httpStatus: number;
    };
}