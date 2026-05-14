export interface UnifiedSearchRequest {
  destination: string;          // free text (city name) OR lat/lng
  destinationCode?: string;     // explicit RateGain destination code
  checkin: string;              // YYYY-MM-DD
  checkout: string;             // YYYY-MM-DD
  rooms: UnifiedRoom[];
  currency?: string;            // default USD
  countryCode?: string;         // default US
  pageNo?: number;              // 1-indexed pagination
  _geoCenter?: { lat: number; lng: number } | null; // internal: pre-resolved coords
}

export interface UnifiedRoom {
  adults: number;
  children: number;
  childAges: number[];
}

export interface UnifiedHotel {
  hotelId: string;              // "RG:ChIJ..." or "TJ:10000000012345"
  source: "RG" | "TJ";
  name: string;
  address: string;
  city: string;
  country: string;
  starRating: number;
  latitude: number;
  longitude: number;
  images: string[];
  price: number;                // lowest available rate
  currency: string;
  mealBasis?: string;           // "Room Only", "Breakfast", etc.
  isRefundable?: boolean;
  onHoldAllowed?: boolean;
  holdConfirm?: boolean;
  amenities: string[];
  propertyCode?: string;
  brandCode?: string;
  rawPayload: unknown;          // keep original for detail/book calls
  altDeal?: {                   // cross-provider comparison
    source: "RG" | "TJ";
    price: number;
    currency?: string;
  };
}
