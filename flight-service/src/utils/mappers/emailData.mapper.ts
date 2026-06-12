import { Booking } from "../../types/bookingLocal.types";

interface TripjackBookingResponse {
  order: {
    BookingId: string;
    Amount: number;
    status: string;
    createdOn: string;
    DeliveryInformation: {
      Emails: string[];
      Contacts: string[];
    };
    EmergencyContactInformation: {
      EmergencyContactName: string;
      Emails: string[];
      Contacts: string[];
    };
  };
  itemInfos: {
    AIR: {
      TripInformation: Array<{
        SegmentInformation: Array<{
          SegmentID: string;
          FlightDetails: {
            AirlineInfo: {
              SSRCode: string;
              AirlineName: string;
            };
            EquipmentType: string;
            FirstName: string;
          };
          DepartureAirport: {
            SSRCode: string;
            AirlineName: string;
            cityCode: string;
            city: string;
            country: string;
            countryCode: string;
            terminal: string;
          };
          ArrivalAirport: {
            SSRCode: string;
            AirlineName: string;
            cityCode: string;
            city: string;
            country: string;
            countryCode: string;
            terminal: string;
          };
          DepartureTime: string;
          ArrivalTime: string;
          Duration: number;
          NumberOfStops: number;
          BaggageInfo: {
            tI: Array<{
              FareDetails: {
                BaggageInfo: {
                  CheckInBaggage: string;
                  ClassCode: string;
                };
                CabinClass: string;
              };
            }>;
          };
        }>;
      }>;
      TravellerInformation: Array<{
        SSR_Seat_Information: Record<string, {
          seatNo: string;
          Amount?: number;
        }>;
        SSR_Baggage_Information: Record<string, {
          SSRCode: string;
          Description: string;
          Amount?: number;
        }>;
        SSR_Meal_Information?: Record<string, {
          Description: string;
        }>;
        pnrDetails: Record<string, string>;
        Title: string;
        PaxType: string;
        FirstName: string;
        LastName: string;
        DateOfBirth: string;
        FareDetails?: {
          BaggageInfo?: {
            CheckInBaggage: string;
          };
        };
      }>;
    };
  };
}

interface UnifiedEmailData {
  bookingId: string;
  status: string;
  createdOn: string;
  deliveryEmail: string;
  deliveryPhone: string;
  emergencyContact: {
    name: string;
    email: string;
    phone: string;
  };
  flights: Array<{
    segmentId: string;
    segmentIndex: number;
    uniqueKey: string;
    airline: string;
    airlineCode: string;
    flightNumber: string;
    equipmentType: string;
    from: {
      code: string;
      name: string;
      city: string;
      country: string;
      terminal: string;
    };
    to: {
      code: string;
      name: string;
      city: string;
      country: string;
      terminal: string;
    };
    departureTime: string;
    arrivalTime: string;
    duration: number;
    stops: number;
    cabinClass: string;
    checkInBaggage: string;
    cabinBaggage: string;
    pnr?: string;
  }>;
  travellers: Array<{
    travellerId: string;
    title: string;
    firstName: string;
    lastName: string;
    paxType: string;
    dateOfBirth: string;
    seats: Array<{
      segmentKey: string;
      seatNumber: string;
      route: string;
    }>;
    baggage: Array<{
      segmentKey: string;
      code: string;
      description: string;
      route: string;
    }>;
    meals: Array<{
      segmentKey: string;
      description: string;
      route: string;
    }>;
  }>;
  priceBreakdown: {
    tripjackPrice: number;
    markupPrice: number;
    totalPrice: number;
  };
}

// Generate unique key for each segment
function getUniqueSegmentKey(segment: any, index: number): string {
  const departure = segment.DepartureAirport?.SSRCode || 'UNK';
  const arrival = segment.ArrivalAirport?.SSRCode || 'UNK';
  const date = new Date(segment.DepartureTime).toISOString().split('T')[0];
  return `${departure}-${arrival}-${date}-${index}`;
}

function getDisplayRoute(segment: any): string {
  return `${segment.DepartureAirport?.SSRCode || 'UNK'}-${segment.ArrivalAirport?.SSRCode || 'UNK'}`;
}

export function mapToUnifiedEmailData(
  tripjackData: any,
  localBookingData: Booking
): UnifiedEmailData {
  // CHANGE: Get ALL segments from ALL trips (not just first trip)
  const allTrips = tripjackData?.itemInfos?.AIR?.TripInformation || [];
  const allSegments: any[] = [];

  allTrips.forEach((trip: any) => {
    if (trip.SegmentInformation && Array.isArray(trip.SegmentInformation)) {
      allSegments.push(...trip.SegmentInformation);
    }
  });

  const travellerInfo = tripjackData?.itemInfos?.AIR?.TravellerInformation?.[0] || {};

  const seatInfo = travellerInfo.SSR_Seat_Information || {};
  const baggageInfo = travellerInfo.SSR_Baggage_Information || {};
  const mealInfo = travellerInfo.SSR_Meal_Information || {};
  const pnrDetails = travellerInfo.pnrDetails || {};

  // Map flights using allSegments (not segments)
  const flights = allSegments.map((segment: any, index: number) => {
    const uniqueKey = getUniqueSegmentKey(segment, index);
    const baggageData = segment.BaggageInfo?.tI?.[0]?.FareDetails?.BaggageInfo;
    const route = getDisplayRoute(segment);

    // Get PNR for this specific segment/route
    let segmentPnr = 'N/A';

    // Try to get PNR from pnrDetails using route key
    if (pnrDetails[route]) {
      segmentPnr = pnrDetails[route];
    }
    // Try using uniqueKey
    else if (pnrDetails[uniqueKey]) {
      segmentPnr = pnrDetails[uniqueKey];
    }
    // Try to find any PNR that might contain this route
    else {
      const matchingKey = Object.keys(pnrDetails).find(key =>
        key.includes(route) || route.includes(key)
      );
      if (matchingKey) {
        segmentPnr = pnrDetails[matchingKey];
      }
    }

    // If still no PNR, check travellerInfo for this segment index
    if (segmentPnr === 'N/A' && travellerInfo.pnrDetails) {
      // Some APIs store PNRs as array values
      const pnrValues = Object.values(travellerInfo.pnrDetails);
      if (pnrValues[index]) {
        segmentPnr = pnrValues[index] as string;
      } else if (pnrValues[0]) {
        segmentPnr = pnrValues[0] as string;
      }
    }

    return {
      segmentId: segment.SegmentID,
      segmentIndex: index,
      uniqueKey: uniqueKey,
      route: route,  // Add route for reference
      airline: segment.FlightDetails?.AirlineInfo?.AirlineName || 'N/A',
      airlineCode: segment.FlightDetails?.AirlineInfo?.SSRCode || 'N/A',
      flightNumber: segment.FlightDetails?.FirstName || '',
      equipmentType: segment.FlightDetails?.EquipmentType || 'N/A',
      from: {
        code: segment.DepartureAirport?.SSRCode || 'N/A',
        name: segment.DepartureAirport?.AirlineName || 'N/A',
        city: segment.DepartureAirport?.city || 'N/A',
        country: segment.DepartureAirport?.country || 'N/A',
        terminal: segment.DepartureAirport?.terminal || 'N/A',
      },
      to: {
        code: segment.ArrivalAirport?.SSRCode || 'N/A',
        name: segment.ArrivalAirport?.AirlineName || 'N/A',
        city: segment.ArrivalAirport?.city || 'N/A',
        country: segment.ArrivalAirport?.country || 'N/A',
        terminal: segment.ArrivalAirport?.terminal || 'N/A',
      },
      departureTime: segment.DepartureTime,
      arrivalTime: segment.ArrivalTime,
      duration: segment.Duration || 0,
      stops: segment.NumberOfStops || 0,
      cabinClass: segment.BaggageInfo?.tI?.[0]?.FareDetails?.CabinClass || 'ECONOMY',
      checkInBaggage: baggageData?.CheckInBaggage || '15 KG',
      cabinBaggage: baggageData?.ClassCode || '7 Kg',
      pnr: segmentPnr,  // Route-specific PNR
    };
  });

  // Rest of the code remains exactly the same from here
  const travellers = localBookingData.travellers.map((localTraveller: any, travellerIndex: number) => {
    const tripjackTraveller = tripjackData?.itemInfos?.AIR?.TravellerInformation?.find(
      (t: any) => t.FirstName === localTraveller.firstName && t.LastName === localTraveller.lastName
    ) || travellerInfo;

    const seats: Array<any> = [];
    const baggage: Array<any> = [];
    const meals: Array<any> = [];

    allSegments.forEach((segment: any, segIndex: number) => {
      const route = getDisplayRoute(segment);
      const uniqueKey = getUniqueSegmentKey(segment, segIndex);

      const seatData = (tripjackTraveller?.SSR_Seat_Information || seatInfo)[route] ||
        (tripjackTraveller?.SSR_Seat_Information || seatInfo)[uniqueKey];
      if (seatData?.seatNo) {
        seats.push({
          segmentKey: uniqueKey,
          seatNumber: seatData.seatNo,
          route: route,
        });
      }

      const bagData = (tripjackTraveller?.SSR_Baggage_Information || baggageInfo)[route] ||
        (tripjackTraveller?.SSR_Baggage_Information || baggageInfo)[uniqueKey];
      if (bagData?.Description) {
        baggage.push({
          segmentKey: uniqueKey,
          code: bagData.SSRCode || 'N/A',
          description: bagData.Description,
          route: route,
        });
      }

      const mealData = (tripjackTraveller?.SSR_Meal_Information || mealInfo)[route] ||
        (tripjackTraveller?.SSR_Meal_Information || mealInfo)[uniqueKey];
      if (mealData?.Description) {
        meals.push({
          segmentKey: uniqueKey,
          description: mealData.Description,
          route: route,
        });
      }
    });

    if (seats.length === 0 && localTraveller.ssrSeatInfos) {
      localTraveller.ssrSeatInfos.forEach((seat: any, idx: number) => {
        if (idx < flights.length) {
          seats.push({
            segmentKey: flights[idx].uniqueKey,
            seatNumber: seat.code,
            route: getDisplayRoute(allSegments[idx]),
          });
        }
      });
    }

    if (baggage.length === 0 && localTraveller.ssrBaggageInfos) {
      localTraveller.ssrBaggageInfos.forEach((bag: any, idx: number) => {
        if (idx < flights.length) {
          baggage.push({
            segmentKey: flights[idx].uniqueKey,
            code: bag.code,
            description: `Excess Baggage`,
            route: getDisplayRoute(allSegments[idx]),
          });
        }
      });
    }

    return {
      travellerId: localTraveller.travellerId,
      title: localTraveller.title || tripjackTraveller?.Title || 'Mr',
      firstName: localTraveller.firstName,
      lastName: localTraveller.lastName,
      paxType: localTraveller.paxType || tripjackTraveller?.PaxType || 'ADULT',
      dateOfBirth: localTraveller.dob || tripjackTraveller?.DateOfBirth || '',
      seats: seats,
      baggage: baggage,
      meals: meals,
    };
  });

  return {
    bookingId: tripjackData.order?.BookingId || localBookingData.bookingId,
    status: tripjackData.order?.status || 'SUCCESS',
    createdOn: tripjackData.order?.createdOn || new Date().toISOString(),
    deliveryEmail: tripjackData.order?.DeliveryInformation?.Emails?.[0] || localBookingData.email || '',
    deliveryPhone: tripjackData.order?.DeliveryInformation?.Contacts?.[0] || localBookingData.phone || '',
    emergencyContact: {
      name: tripjackData.order?.EmergencyContactInformation?.EmergencyContactName || localBookingData.emergencyContact?.name || '',
      email: tripjackData.order?.EmergencyContactInformation?.Emails?.[0] || localBookingData.emergencyContact?.email || '',
      phone: tripjackData.order?.EmergencyContactInformation?.Contacts?.[0] || localBookingData.emergencyContact?.phone || '',
    },
    flights: flights,  // Using allSegments mapped flights
    travellers: travellers,
    priceBreakdown: {
      tripjackPrice: localBookingData.tripjackPrice || 0,
      markupPrice: localBookingData.markupPrice || 0,
      totalPrice: localBookingData.totalPrice || localBookingData.tripjackPrice || 0,
    },
  };
}