/**
 * TripJack Cabs API v2 types.
 *
 * Modelled from "Cabs API Documentation - v2". These describe the shapes we
 * send to / receive from TripJack. They are intentionally close to the wire
 * format so the adapter/provider layers stay thin.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type JourneyType =
  | "airport_transfer"
  | "outstation"
  | "local"
  | "rental";

export type TripType = "oneway" | "roundtrip" | "return";

// NOTE: the internal booking lifecycle enum `CabBookingStatus` is the canonical
// export from models/CabBooking.model.ts (many modules import it from there).

// ─── Location / route ───────────────────────────────────────────────────────

export interface AddressInfo {
  subLocality?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

/** A pickup/drop point. `lat`/`long` are strings per TripJack's contract. */
export interface LocationDto {
  type: "location";
  displayAddress: string;
  lat: string;
  long: string;
  address: AddressInfo;
}

export interface RouteDetail {
  isDomestic?: boolean;
  origin: LocationDto;
  destination: LocationDto;
}

// ─── Location search APIs ───────────────────────────────────────────────────

export interface LocationSearchRequest {
  input: string;
}

export interface LatLongSearchRequest {
  placeId: string;
}

// ─── Quotes API (/cabs/v2/quotes) ───────────────────────────────────────────

export interface QuoteRequest {
  pickupDate: string; // "yyyy-MM-dd HH:mm", >= 2h in future
  returnDate?: string; // required when tripType=roundtrip/return, >= 30m after pickup
  origin: LocationDto;
  destination: LocationDto;
  journeyType: JourneyType;
  tripType: TripType;
  passengers: number; // 1..10
  durationInMinutes?: number;
  distanceInKm?: number;
  /** Embedded (cab-with-flight) bookings: a successful AIR booking id. */
  sourceBookingId?: string;
  quoteFilter?: { paxCount: number };
  correlationId?: string;
}

export interface FareBreakup {
  onwardFare?: number;
  backwardFare?: number;
  totalFare: number;
  onwardTax?: number;
  backwardTax?: number;
  totalTax: number;
}

export interface CancellationPolicyItem {
  minHours: number;
  refundPercentage: number;
  description: string;
}

export interface CabPolicies {
  amendmentPolicy?: string;
  cancellationPolicy?: CancellationPolicyItem[];
  inclusions?: string[];
  exclusions?: string[];
  baggagePolicy?: string[];
  waitingTime?: string;
  termsAndPolicies?: string[];
  meetAndGreet?: string[];
}

/** A single bookable quote within a vehicle group. */
export interface CommonQuoteDto {
  vendorId: number;
  vehicleCategoryId?: string | number;
  vehicleTypeId?: string | number;
  quotationId: string;
  quoteChildId: string;
  fareBreakup: FareBreakup;
  benefits?: string[];
  policies?: CabPolicies;
  sku?: string;
  paxCount: number;
  luggageCount: number;
  model?: string;
}

/** A vehicle group (e.g. "Standard Sedan") containing one or more quotes. */
export interface QuoteVehicleGroup {
  vehicleType: string;
  vehicleCategory: string;
  label?: string;
  modelName?: string | null;
  paxCapacity?: string;
  luggageCapacity?: string;
  vehicleImages?: string[];
  similarType?: string;
  quotes: CommonQuoteDto[];
}

export interface JourneyInfo {
  journeyType: string;
  tripType: string;
  pickupDateTime: string;
  returnDateTime?: string;
  journeyLeg?: string;
  distance?: string;
  duration?: number;
  flightDetails?: any;
}

export interface QuoteResponseData {
  journeyInfo: JourneyInfo;
  routeDetails: RouteDetail;
  quotesInfo: QuoteVehicleGroup[];
}

export interface QuoteResponse {
  success: boolean;
  message: string;
  data: QuoteResponseData;
}

// ─── Booking API (/cabs/v2/booking) ─────────────────────────────────────────

export interface FlightDetails {
  number?: string;
}

export interface PassengerDetail {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  flightDetails?: FlightDetails;
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

export interface AgentMarkupSplitup {
  onwardJourneyMarkup: number;
  returnJourneyMarkup: number;
}

export interface PricingInfo {
  netAmount: string;
  addonsPrice: string;
  tjTaxAmount?: string;
  tjManagementFee?: string;
  agentMarkup: number;
  agentMarkupSplitup: AgentMarkupSplitup;
  grossAmount: string;
}

export interface BookingRequest {
  journeyInfo: JourneyInfo;
  routeDetail: RouteDetail;
  addons?: any[];
  quotationInfo: QuotationInfo;
  pricingInfo: PricingInfo;
  passengerDetail: PassengerDetail;
  serviceRequest?: string;
  consent: string;
  agentEmail: string;
  agentPhone: string;
  agentId: number | string;
  vendorId?: number;
  correlationId?: string;
}

/** Embedded (cab-with-flight) booking. */
export interface EmbeddedBookingRequest {
  sourceBookingId: string;
  productType: "AIR";
  bookingRequestList: BookingRequest[];
  correlationId?: string;
}

// ─── Payment API (/cabs/v1/payment/create) ──────────────────────────────────

export interface PaymentRequest {
  amount: number;
  payUserId?: string;
  paymentMedium?: string; // "WALLET"
  bookingId: string;
  opType?: string; // "DEBIT"
  product?: string; // "CAB"
  transactionType?: string; // "PAID_FOR_ORDER"
  correlationId?: string;
}

// ─── Amendment / cancellation (/cabs/v1/amendment) ──────────────────────────

export type AmendmentType = "CANCELLATION";

export interface CancellationRequest {
  bookingId: string;
  amendmentType: AmendmentType;
  reason?: string;
  correlationId?: string;
}

export interface AmendmentChargeConfig {
  minHours: number;
  refundPercentage: number;
  description: string;
}

export interface AmendmentCharges {
  bookingId: string;
  amendType: AmendmentType;
  description?: string;
  tjAmendmentCharge?: number;
  tjManagementFee?: number;
  refundAmount?: number;
  amountPayable?: number;
  amountPaid?: number;
  appliedAmendmentConfig?: AmendmentChargeConfig;
}
