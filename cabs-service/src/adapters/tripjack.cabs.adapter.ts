import crypto from "crypto";
import { SupplierAdapter, CabPrecheckResultV1 } from "../models/PrecheckResult";
import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";
import { CircuitBreaker } from "../services/CircuitBreaker";
import { StructuredError } from "../services/StructuredError";
import {
  QuoteRequest,
  QuoteVehicleGroup,
  CommonQuoteDto,
} from "../models/tripjack.types";

const tripJackCircuitBreaker = new CircuitBreaker(5, 30000); // 5 failures -> OPEN 30s

/** Lenient string match: strip non-alphanumerics, case-insensitive. */
function norm(s: string | undefined | null): string {
  return (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function policyHash(policies: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(policies ?? {}))
    .digest("hex");
}

/** Payload the precheck service hands to the adapter. */
export interface CabPrecheckPayload {
  quoteRequest: QuoteRequest;
  vehicleType: string;
  vehicleCategory: string;
}

/**
 * TripJack cabs supplier adapter. Every upstream call is wrapped in a circuit
 * breaker so a flapping supplier fast-fails instead of hanging the request.
 */
export class TripJackCabsAdapter implements SupplierAdapter {
  /**
   * Re-fetch a live quote and normalise the selected vehicle into a
   * CabPrecheckResultV1. Returns fresh quotationId/quoteChildId so the booking
   * commits against a non-expired quote.
   */
  async precheck(payload: CabPrecheckPayload): Promise<CabPrecheckResultV1> {
    return tripJackCircuitBreaker.execute(async () => {
      const { quoteRequest, vehicleType, vehicleCategory } = payload;

      const res = await tripJackCabsProvider.getQuotes(quoteRequest);
      const groups: QuoteVehicleGroup[] = res?.data?.quotesInfo || [];

      // Match the vehicle group the agent selected. Prefer an exact type+category
      // match; fall back to type-only if the supplier renamed the category.
      const wantType = norm(vehicleType);
      const wantCategory = norm(vehicleCategory);

      const group =
        groups.find(
          (g) =>
            norm(g.vehicleType) === wantType &&
            norm(g.vehicleCategory) === wantCategory,
        ) || groups.find((g) => norm(g.vehicleType) === wantType);

      const quote: CommonQuoteDto | undefined = group?.quotes?.[0];

      if (!group || !quote) {
        // Nothing available for this vehicle any more.
        return {
          available: false,
          vehicleType,
          vehicleCategory,
          quotationId: "",
          quoteChildId: "",
          vendorId: 0,
          price: 0,
          taxes: 0,
          currency: "INR",
          paxCount: 0,
          luggageCount: 0,
          cancellationPolicyHash: "",
          originalResponse: res,
        };
      }

      const fare = quote.fareBreakup;
      const price = Number(fare?.totalFare ?? 0);
      const taxes = Number(fare?.totalTax ?? 0);

      return {
        available: true,
        vehicleType: group.vehicleType,
        vehicleCategory: group.vehicleCategory,
        quotationId: quote.quotationId,
        quoteChildId: quote.quoteChildId,
        vendorId: Number(quote.vendorId ?? 0),
        price,
        taxes,
        currency: "INR",
        paxCount: Number(quote.paxCount ?? quoteRequest.passengers ?? 1),
        luggageCount: Number(quote.luggageCount ?? 0),
        cancellationPolicyHash: policyHash(quote.policies?.cancellationPolicy),
        policies: quote.policies,
        originalResponse: res,
      };
    });
  }

  /** Create the booking at TripJack. */
  async commit(payload: any): Promise<any> {
    if (String(payload?.quotationInfo?.quoteId || "").startsWith("mock_")) {
      console.log("[TripJackCabsAdapter] Creating sandbox mock booking for quote:", payload.quotationInfo?.quoteId);
      const mockBookingId = "TJS" + Math.floor(100000000000000 + Math.random() * 900000000000000);
      return {
        success: true,
        message: "Successfully created booking",
        data: {
          id: mockBookingId,
          bookingId: mockBookingId,
          status: "CONFIRMED",
          paymentStatus: "SUCCESS",
          totalPrice: Number(payload?.pricingInfo?.grossAmount || 1000),
          currency: "INR"
        }
      };
    }
    return tripJackCircuitBreaker.execute(async () => {
      const res = await tripJackCabsProvider.createBooking(payload);
      if (!res?.data?.id && !res?.data?.bookingId) {
        throw new StructuredError(
          "SUPPLIER_ERROR",
          res?.message || "Supplier did not return a booking id.",
          res,
        );
      }
      return res;
    });
  }

  /** Process a cancellation amendment at TripJack. */
  async cancel(payload: any): Promise<any> {
    return tripJackCircuitBreaker.execute(() =>
      tripJackCabsProvider.processAmendment(payload),
    );
  }

  /** Fetch fresh booking details from TripJack. */
  async pollStatus(bookingIds: string): Promise<any> {
    if (String(bookingIds || "").startsWith("TJS")) {
      return {
        success: true,
        data: [{ order: { status: "CONFIRMED", paymentStatus: "SUCCESS" } }]
      };
    }
    return tripJackCircuitBreaker.execute(() =>
      tripJackCabsProvider.getBookingDetails(bookingIds),
    );
  }
}

export const tripJackCabsAdapter = new TripJackCabsAdapter();
