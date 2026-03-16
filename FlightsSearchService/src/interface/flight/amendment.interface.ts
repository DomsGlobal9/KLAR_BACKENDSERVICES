export interface AmendmentChargesRequest {
    bookingId: string;
    type: 'CANCELLATION';
    remarks: string;
    trips?: AmendmentTrip[];
}

export interface AmendmentSubmitRequest {
    bookingId: string;
    type: 'CANCELLATION';
    remarks: string;
    trips?: AmendmentTrip[];
}

export interface AmendmentDetailsRequest {
    amendmentId: string;
}

export interface AmendmentTrip {
    src: string;
    dest: string;
    departureDate: string;
    travellers?: AmendmentTraveller[];
}

export interface AmendmentTraveller {
    fn: string;
    ln: string;
}

export interface AmendmentChargesResponse {
    bookingId: string;
    trips?: AmendmentTripCharges[];
    errors?: Array<{ code: string; message: string }>;
}

export interface AmendmentTripCharges {
    src: string;
    dest: string;
    departureDate: string;
    flightNumbers: string[];
    airlines: string[];
    amendmentInfo: Record<string, PaxAmendmentCharges>;
    travellers?: AmendmentTravellerDetail[];
}

export interface PaxAmendmentCharges {
    message?: string;
    amendmentCharges: number;
    refundAmount: number;
    totalFare: number;
}

export interface AmendmentTravellerDetail {
    fn: string;
    ln: string;
    amendmentCharges: number;
    refundAmount: number;
    totalFare: number;
}

export interface AmendmentSubmitResponse {
    bookingId: string;
    amendmentId: string;
    status: {
        success: boolean;
        httpStatus: number;
    };
}

export interface AmendmentDetailsResponse {
    bookingId: string;
    amendmentId: string;
    amendmentStatus: 'REQUESTED' | 'REJECTED' | 'SUCCESS' | 'PENDING';
    amendmentCharges: number;
    refundableAmount: number;
    totalFare: number;
    trips?: AmendmentTripCharges[];
    status: {
        success: boolean;
        httpStatus: number;
    };
}