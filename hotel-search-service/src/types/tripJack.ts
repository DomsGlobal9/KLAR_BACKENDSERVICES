export interface TripJackSearchRequest {
  checkIn: string;
  checkOut: string;
  rooms: { adults: number; children?: number; childAge?: number[] }[];
  currency?: string;
  correlationId?: string;
  hids?: string[];
  nationality?: string;
}

export interface TripJackHotelListingResponse {
  correlationId: string;
  currency: string;
  totalResults: number;
  hotels: TripJackHotel[];
  status: { success: boolean };
}

export interface TripJackHotel {
  tjHotelId: string;
  name: string;
  options: TripJackOption[];
}

export interface TripJackOption {
  optionId: string;
  optionType: string;
  mealBasis: string;
  pricing: {
    totalPrice: number;
    basePrice: number;
    taxes: number;
    mf: number;
    mft: number;
    currency: string;
  };
  cancellation: {
    isRefundable: boolean;
    penalties: any[];
  };
}
