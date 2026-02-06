import {
  Trip,
  Segment,
  SSRGroup,
  ReviewResult
} from "../types/review.types";
import { calculateExpiry } from "../utils/time.util";

export function mapReviewResponse(response: any): ReviewResult {
  return {
    reviewId: response.bookingId,
    expiresAt: calculateExpiry(
      response.conditions.sct,
      response.conditions.st
    ),
    price: {
      totalFare: response.totalPriceInfo.totalFareDetail.fC.TF,
      baseFare: response.totalPriceInfo.totalFareDetail.fC.BF,
      taxes: response.totalPriceInfo.totalFareDetail.fC.TAF
    },
    trips: response.tripInfos.map(mapTrip),
    conditions: extractConditions(response.conditions),
    ssrAllowed: extractSSRAvailability(response)
  };
}

function mapTrip(trip: any): Trip {
  return {
    priceId: trip.totalPriceList[0].id,
    fareIdentifier: trip.totalPriceList[0].fareIdentifier,
    segments: trip.sI.map(mapSegment)
  };
}

function mapSegment(seg: any): Segment {
  return {
    segmentId: seg.id,
    from: seg.da.code,
    to: seg.aa.code,
    departure: seg.dt,
    arrival: seg.at,
    airline: seg.fD.aI.code,
    flightNumber: seg.fD.fN,
    ssr: extractSSR(seg)
  };
}

function extractSSR(seg: any): SSRGroup[] {
  if (!seg.ssrInfo) return [];

  return Object.keys(seg.ssrInfo).map(type => ({
    type,
    options: seg.ssrInfo[type].map((s: any) => ({
      code: s.code,
      amount: s.amount,
      description: s.desc
    }))
  }));
}

function extractConditions(c: any) {
  return {
    dob: {
      adult: c.dob?.adobr ?? false,
      child: c.dob?.cdobr ?? false,
      infant: c.dob?.idobr ?? false
    },
    gst: {
      mandatory: c.gst?.igm ?? false,
      applicable: c.gst?.gstappl ?? false
    },
    emergencyContactRequired: c.iecr ?? false,
    holdAllowed: c.isBA ?? false
  };
}

function extractSSRAvailability(response: any) {
  // Check if any segment has MEAL or BAGGAGE SSR available
  let hasMeal = false;
  let hasBaggage = false;

  if (response.tripInfos && Array.isArray(response.tripInfos)) {
    for (const trip of response.tripInfos) {
      if (trip.sI && Array.isArray(trip.sI)) {
        for (const segment of trip.sI) {
          if (segment.ssrInfo) {
            if (segment.ssrInfo.MEAL && segment.ssrInfo.MEAL.length > 0) {
              hasMeal = true;
            }
            if (segment.ssrInfo.BAGGAGE && segment.ssrInfo.BAGGAGE.length > 0) {
              hasBaggage = true;
            }
          }
        }
      }
    }
  }

  return {
    seat: response.conditions?.isa === true,
    meal: hasMeal,
    baggage: hasBaggage,
    hold: response.conditions?.isBA === true,
    frequentFlier: response.conditions?.ffas?.length > 0
  };
}
