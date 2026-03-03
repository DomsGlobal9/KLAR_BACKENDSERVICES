export interface ReviewRequest {
    priceIds: string[];
}

export interface ReviewResponse {
    tripInfos: ReviewTripInfo[];
    searchQuery: ReviewSearchQuery;
    bookingId: string;
    totalPriceInfo: ReviewTotalPriceInfo;
    status: ReviewStatus;
    conditions?: ReviewConditions;
}

export interface ReviewTripInfo {
    sI: ReviewSegment[];
    totalPriceList: ReviewFareDetail[];
}

export interface ReviewSegment {
    id: string;
    fD: {
        aI: {
            code: string;
            name: string;
            isLcc: boolean;
        };
        fN: string;
        eT: string;
    };
    stops: number;
    so?: any[];
    duration: number;
    da: ReviewAirport;
    aa: ReviewAirport;
    dt: string;
    at: string;
    iand: boolean;
    isRs: boolean;
    sN: number;
    ssrInfo?: ReviewSSRInfo;
    ac?: any[];
}

export interface ReviewAirport {
    code: string;
    name: string;
    cityCode: string;
    city: string;
    country: string;
    countryCode: string;
    terminal?: string;
}

export interface ReviewSSRInfo {
    MEAL?: ReviewSSROption[];
    BAGGAGE?: ReviewSSROption[];
}

export interface ReviewSSROption {
    code: string;
    amount: number;
    desc: string;
}

export interface ReviewFareDetail {
    fd: {
        ADULT: ReviewPassengerFare;
        CHILD?: ReviewPassengerFare;
        INFANT?: ReviewPassengerFare;
    };
    fareIdentifier: string;
    id: string;
    messages?: any[];
    pc?: {
        code: string;
        name: string;
        isLcc: boolean;
    };
    tai?: {
        tbi?: Record<string, ReviewBaggageInfo[]>;
    };
}

export interface ReviewPassengerFare {
    fC: {
        TAF: number;
        NF: number;
        BF: number;
        TF: number;
        OB?: number;
    };
    afC?: {
        TAF: {
            OT?: number;
            AGST?: number;
            MFT?: number;
            MF?: number;
            YR?: number;
            YQ?: number;
        };
    };
    sR?: number;
    bI: {
        iB?: string;
        cB?: string;
    };
    rT: number;
    cc?: string;
    cB?: string;
    fB?: string;
    mI?: boolean;
}

export interface ReviewBaggageInfo {
    ADULT?: {
        iB: string;
        cB: string;
    };
    CHILD?: {
        iB: string;
        cB: string;
    };
    INFANT?: {
        iB: string;
        cB: string;
    };
}

export interface ReviewSearchQuery {
    routeInfos: Array<{
        fromCityOrAirport: ReviewLocation;
        toCityOrAirport: ReviewLocation;
        travelDate: string;
    }>;
    cabinClass: string;
    paxInfo: {
        ADULT: number;
        CHILD: number;
        INFANT: number;
    };
    searchType: string;
    origSearchType: string;
    searchModifiers: any;
    sourceIds: number[];
    isDomestic: boolean;
    isCustomCombination: boolean;
    isOneWay: boolean;
    isDomesticMultiCity: boolean;
    isDomesticReturn: boolean;
    isMultiCity: boolean;
}

export interface ReviewLocation {
    code: string;
    name: string;
    cityCode: string;
    city: string;
    country: string;
    countryCode: string;
}

export interface ReviewTotalPriceInfo {
    totalFareDetail: {
        fC: {
            TAF: number;
            NF: number;
            BF: number;
            TF: number;
        };
        afC?: {
            TAF: {
                OT?: number;
                AGST?: number;
            };
        };
    };
}

export interface ReviewStatus {
    success: boolean;
    httpStatus: number;
}

export interface ReviewConditions {
    ffas: any[];
    isa: boolean;
    dob: {
        adobr: boolean;
        cdobr: boolean;
        idobr: boolean;
    };
    isBA: boolean;
    st: number;
    sct: string;
    gst: {
        gstappl: boolean;
        igm: boolean;
    };
}

// Transformed interfaces for frontend
export interface TransformedReviewPrice {
    bookingId: string;
    totalPrice: {
        baseFare: number;
        taxesAndFees: number;
        totalFare: number;
        netFare: number;
        breakdown?: {
            otherTax?: number;
            serviceTax?: number;
            managementFee?: number;
            airportTax?: number;
            fuelSurcharge?: number;
        };
    };
    flights: TransformedReviewFlight[];
    passengerSummary: {
        adult: number;
        child: number;
        infant: number;
        totalPassengers: number;
    };
    fareRules?: any; // Can be added later
}

export interface TransformedReviewFlight {
    segmentId: string;
    flightNumber: string;
    airline: {
        code: string;
        name: string;
        isLcc: boolean;
    };
    departure: {
        airportCode: string;
        airportName: string;
        time: string;
        date: string;
        datetime?: string;
    };
    arrival: {
        airportCode: string;
        airportName: string;
        time: string;
        date: string;
        datetime?: string;
    };
    duration: number;
    stops: number;
    fareOptions: TransformedReviewFareOption[];
}

export interface TransformedReviewFareOption {
    fareId: string;
    fareIdentifier: string;
    cabinClass: string;
    bookingClass: string;
    fareBasis: string;
    baseFare: number;
    taxesAndFees: number;
    totalFare: number;
    netFare: number;
    refundable: boolean;
    baggage: {
        checked: string;
        cabin: string;
    };
    seatAvailability?: number;
    passengerBreakdown?: {
        adult?: {
            baseFare: number;
            taxesAndFees: number;
            totalFare: number;
        };
        child?: {
            baseFare: number;
            taxesAndFees: number;
            totalFare: number;
            baggage?: {
                checked: string;
                cabin: string;
            };
        };
        infant?: {
            baseFare: number;
            taxesAndFees: number;
            totalFare: number;
            baggage?: {
                checked: string;
                cabin: string;
            };
        };
    };
    fareBreakdown?: {
        managementFee?: number;
        otherTax?: number;
        serviceTax?: number;
        airportTax?: number;
        fuelSurcharge?: number;
    };
}

export interface ReviewError {
    id: string;
    error: string;
    message?: string;
}