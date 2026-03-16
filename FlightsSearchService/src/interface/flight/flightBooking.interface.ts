import { BookingStatus, PassengerType, Title } from "../../models/flightBooking.model";


export interface CreateFlightBookingDTO {
  bookingId: string;
  userId: string;
  paymentInfos: Array<{ amount: number }>;
  travellerInfo: Array<{
    ti: Title;
    fN: string;
    lN: string;
    pt: PassengerType;
    dob: string;
    pNat?: string;
    pNum?: string;
    eD?: string;
    pid?: string;
    di?: string;
    ssrBaggageInfos?: Array<{ key: string; code: string }>;
    ssrMealInfos?: Array<{ key: string; code: string }>;
    ssrSeatInfos?: Array<{ key: string; code: string }>;
    ssrExtraServiceInfos?: Array<{ key: string; code: string }>;
  }>;
  gstInfo?: {
    gstNumber: string;
    registeredName: string;
    email?: string;
    mobile?: string;
    address?: string;
  };
  deliveryInfo: {
    emails: string[];
    contacts: string[];
  };
  contactInfo?: {
    emails: string[];
    contacts: string[];
    ecn?: string;
  };
  totalAmount: number;
  priceIds?: string[];
  tripDetails?: any;
}

export interface UpdateBookingStatusDTO {
  status: BookingStatus;
  failureReason?: string;
}