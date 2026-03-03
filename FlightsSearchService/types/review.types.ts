export interface ReviewInput {
  searchId: string;
  priceIds: string[];
}

export interface ReviewResult {
  reviewId: string;
  expiresAt: string;
  price: TotalFare;
  trips: Trip[];
  conditions: BookingConditions;
  ssrAllowed: SSRAvailability;
  fareChange?: FareChange;
}

export interface RevalidateInput {
  reviewId: string;
}

export interface RevalidateResult {
  success: boolean;
  fareValid: boolean;
  price?: TotalFare;
  fareChange?: FareChange;
  message?: string;
}

export interface FareChange {
  oldFare: number;
  newFare: number;
  difference: number;
  percentageChange: number;
}

export interface TotalFare {
  totalFare: number;
  baseFare: number;
  taxes: number;
  currency?: string;
}

export interface Trip {
  priceId: string;
  fareIdentifier: string;
  segments: Segment[];
}

export interface Segment {
  segmentId: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  airline: string;
  flightNumber: string;
  ssr: SSRGroup[];
}

export interface SSRGroup {
  type: string;
  options: SSROption[];
}

export interface SSROption {
  code: string;
  amount: number;
  description: string;
}

export interface BookingConditions {
  dob: {
    adult: boolean;
    child: boolean;
    infant: boolean;
  };
  gst: {
    mandatory: boolean;
    applicable: boolean;
  };
  emergencyContactRequired: boolean;
  holdAllowed: boolean;
}

export interface SSRAvailability {
  seat: boolean;
  meal: boolean;
  baggage: boolean;
  hold: boolean;
  frequentFlier: boolean;
}
