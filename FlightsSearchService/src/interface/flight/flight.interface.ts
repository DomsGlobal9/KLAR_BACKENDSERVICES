import { searchFromTripJack } from "../../services/tripjackService";

export interface FlightSegment {
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
  duration: number;
  da: {
    code: string;
    name: string;
    cityCode: string;
    city: string;
    terminal?: string;
  };
  aa: {
    code: string;
    name: string;
    cityCode: string;
    city: string;
    terminal?: string;
  };
  dt: string;
  at: string;
  iand: boolean;
  isRs: boolean;
  sN: number;
}


export interface FareDetail {
  tai: any;
  fd: {
    ADULT: {
      fC: {
        TAF: number;
        BF: number;
        TF: number;
        NF: number;
        OB?: number;
      };
      afC?: {
        TAF: {
          MFT?: number;
          OT?: number;
          AGST?: number;
          MF?: number;
          YR?: number;
        };
      };
      sR: number;
      bI: {
        iB: string;
        cB: string;
      };
      rT: number;
      cc: string;
      cB: string;
      fB: string;
      mI?: boolean;
    };
  };
  fareIdentifier: string;
  id: string;
  icca: boolean;
}

export interface TripInfo {
  sI: FlightSegment[];
  totalPriceList: FareDetail[];
  airFlowType: string;
  ipm: string;
  issf: boolean;
}

export interface TransformedFlight {
  flightId: string;
  segmentId: string; 
  airline: {
    code: string;
    name: string;
    isLcc: boolean;
  };
  flightNumber: string;
  aircraftType: string;
  departure: {
    airportCode: string;
    airportName: string;
    cityCode: string;
    city: string;
    terminal?: string;
    time: string;
    date: string;
  };
  arrival: {
    airportCode: string;
    airportName: string;
    cityCode: string;
    city: string;
    terminal?: string;
    time: string;
    date: string;
  };
  duration: number;
  stops: number;
  fareOptions: {
    id: string;
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
    seatAvailability: number;
    fareBreakdown?: {
      managementFee?: number;
      otherTax?: number;
      serviceTax?: number;
      airportTax?: number;
      fuelSurcharge?: number;
    };
  }[];
  isInternational: boolean;
  isRedEye: boolean;
}

export interface TripJackSearchPayload {
  searchQuery: {
    cabinClass?: string;
    paxInfo: {
      ADULT: string;
      CHILD: string;
      INFANT: string;
    };
    routeInfos: Array<{
      fromCityOrAirport: {
        code: string;
      };
      toCityOrAirport: {
        code: string;
      };
      travelDate: string;
    }>;
    searchModifiers?: {
      isDirectFlight?: boolean;
      isConnectingFlight?: boolean;
    };
  };
}

export interface SegmentResponse {
  segment: FlightSegment;
  fareOptions: FareDetail[];
  tripInfo: TripInfo;
}

