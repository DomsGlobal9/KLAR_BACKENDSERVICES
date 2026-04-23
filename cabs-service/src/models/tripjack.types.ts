/**
 * TripJack Cabs API Types
 */

export interface LocationRequest {
    input: string;
}

export interface LatLongRequest {
    placeId: string;
}

export interface AddressInfo {
    city: string;
    country: string;
}

export interface JourneyStop {
    type: "location";
    displayAddress: string;
    lat: string;
    long: string;
    address: AddressInfo;
}

export interface QuoteRequest {
    pickupDate: string;
    origin: JourneyStop;
    destination: JourneyStop;
    journeyType: "airport_transfer" | "local" | "outstation";
    tripType: "oneway" | "roundtrip";
    passengers: number;
}

export interface PassengerDetail {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
}

export interface AgentDetail {
    agentId: number | string;
    agentEmail: string;
    agentPhone: string;
}

export interface QuotationInfo {
    vehicleType: string;
    vehicleCategory: string;
    quoteId: string;
    childQuoteId: string;
    paxCount: number;
    luggageCount: number;
    vendorId: number;
}

export interface PricingInfo {
    netAmount: string;
    addonsPrice: string;
    tjTaxAmount?: string;
    agentMarkup: number;
    agentMarkupSplitup: {
        onwardJourneyMarkup: number;
        returnJourneyMarkup: number;
    };
    grossAmount: string;
    tjManagementFee?: string;
}

export interface BookingRequest {
    journeyInfo: any;
    routeDetail: any;
    quotationInfo: QuotationInfo;
    pricingInfo: PricingInfo;
    passengerDetail: PassengerDetail;
    agentId: number | string;
    agentEmail: string;
    agentPhone: string;
    consent: string;
    serviceRequest?: string;
    vendorId?: number;
    correlationId?: string;
}


export interface PaymentRequest {
    bookingId: string;
    amount: number;
    currency?: string;
}

export interface CancellationRequest {
    bookingId: string;
    reason?: string;
    amendmentType: "CANCELLATION";
    correlationId?: string;
}
