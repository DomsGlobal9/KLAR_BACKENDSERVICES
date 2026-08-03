import { MarkupRegion } from "../utils/region.util";

export interface UnifiedFilters {
  starRatings?: number[];
  priceRange?: [number, number];
  priceRanges?: Array<[number, number]>;
  mealTypes?: string[];
  propertyTypes?: string[];
  amenities?: string[];
  searchText?: string;
  showOnlyAltDeals?: boolean;
  providers?: string[];
  userRatings?: number[];
  selectedLocations?: string[];
}

export interface UnifiedSearchRequest {
  destination: string; // free text (city name) OR lat/lng
  destinationCode?: string; // explicit RateGain destination code
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  rooms: UnifiedRoom[];
  currency?: string; // default USD
  countryCode?: string; // default US
  pageNo?: number; // 1-indexed pagination
  limit?: number; // page size when slicing from the cached master list (default 20)
  _geoCenter?: { lat: number; lng: number; radiusKm?: number } | null; // internal: pre-resolved coords
  _abortSignal?: AbortSignal | null; // internal: cancels supplier calls once the partial-return window elapses
  providers?: string[];
  filters?: UnifiedFilters;
  sortBy?: string;
}

export interface UnifiedRoom {
  adults: number;
  children: number;
  childAges: number[];
}

export interface UnifiedHotel {
  hotelId: string; // "RG:ChIJ..." or "TJ:10000000012345"
  source: "RG" | "TJ";
  name: string;
  address: string;
  city: string;
  country: string;
  /**
   * Which markup region this hotel was priced under.
   *
   * Echoed back by the client at commit so booking can detect a quote-vs-charge
   * divergence. It is a DIAGNOSTIC: hotel-booking re-derives the region from the
   * supplier's own response and never lets this value select the markup — see
   * resolveBookingRegion.
   */
  markupRegion?: MarkupRegion;
  starRating: number;
  latitude: number;
  longitude: number;
  images: string[];
  price: number; // Total stay price (base + taxes). Always total.
  basePrice?: number; // Base net price excluding taxes (room only cost)
  taxAmount?: number; // Taxes & fees excluded from base (add-on)
  taxesIncluded?: boolean; // true = price already includes all taxes; false = taxes added on top
  currency: string;
  mealBasis?: string; // "Room Only", "Breakfast", etc.
  hotelSegment?: string;
  accTypeDesc?: string;
  accMultiDesc?: string;
  accomodationType?: string;
  description?: string;
  isRefundable?: boolean;
  refundableLabel?: string; // display-ready, e.g. "Free cancellation till 06 Jul" / "Non-Refundable"
  freeCancellationUntil?: string | null; // ISO date penalties begin, null when non-refundable
  onHoldAllowed?: boolean;
  holdConfirm?: boolean;
  amenities: string[];
  propertyCode?: string;
  correlationId?: string;
  brandCode?: string;
  isMandatory?: boolean;
  commissionAmt?: number;
  commissionPct?: number;
  sellingRate?: number;
  rawPayload: unknown; // keep original for detail/book calls
  altDeal?: {
    // cross-provider comparison
    source: "RG" | "TJ";
    price: number;
    currency?: string;
  };
  paymentType?: string;
  packaging?: boolean;
  boardCode?: string;
  boardName?: string;
  taxes?: {
    taxes: {
      included: boolean;
      amount: string | number;
      currency: string;
      clientAmount?: string | number;
      clientCurrency?: string;
    }[];
    allIncluded: boolean;
  };
  pricing?: {
    totalPrice: number;
    taxes: number | null;
    mf: number;
    mft: number;
    currency: string;
    basePrice: number | null;
    markupAmount: number;
    perNightPrice: number | null;
    supplierTotalPrice: number;
    finalTotalPrice: number;
    taxesIncluded: boolean;
  };
}
