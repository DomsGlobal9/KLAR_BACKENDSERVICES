import { cabSupplierRegistry } from "../suppliers/registry";
import { CabPrecheckResultV1 } from "../models/PrecheckResult";
import { CabPrecheckPayload } from "../adapters/tripjack.cabs.adapter";
import { ValidationEngine, ExpectedCab } from "./ValidationEngine";
import { StructuredError } from "./StructuredError";
import { env } from "../config/env";
import { ensureLocationAddress } from "../utils/location.utils";
import {
  QuoteRequest,
  JourneyInfo,
  RouteDetail,
  JourneyType,
  TripType,
} from "../models/tripjack.types";

/**
 * Convert a supplier ISO datetime ("2026-01-23T09:00:00") — or an already
 * "yyyy-MM-dd HH:mm" string — into the "yyyy-MM-dd HH:mm" the quotes API expects.
 */
function toQuoteDate(value: string | undefined): string {
  if (!value) return "";
  // Already in "yyyy-MM-dd HH:mm"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export interface PrecheckOutput {
  fresh: CabPrecheckResultV1;
  validatedPrice: number;
}

class PrecheckService {
  /**
   * Re-fetch a live quote for the cab in a booking payload and validate it
   * against what the frontend expected. Returns the fresh supplier ids/fare so
   * the booking can commit against a non-expired quote.
   */
  async run(bookingPayload: any): Promise<PrecheckOutput> {
    const journeyInfo: JourneyInfo = bookingPayload.journeyInfo;
    const routeDetail: RouteDetail = bookingPayload.routeDetail;
    const quotationInfo = bookingPayload.quotationInfo || {};
    const pricingInfo = bookingPayload.pricingInfo || {};

    if (!journeyInfo || !routeDetail?.origin || !routeDetail?.destination) {
      throw new StructuredError(
        "VALIDATION_ERROR",
        "journeyInfo and routeDetail (origin + destination) are required for precheck.",
      );
    }

    const journeyType = String(
      journeyInfo.journeyType || "airport_transfer",
    ).toLowerCase() as JourneyType;
    const tripType = String(journeyInfo.tripType || "oneway").toLowerCase() as TripType;

    const passengers = Number(quotationInfo.paxCount) || 1;

    // TripJack's quotes API returns "No Cabs Found!" unless the location carries
    // a real `address` (city/country). Booking payloads from the frontends only
    // send `{displayAddress, lat, long}`, so resolve the address dynamically via
    // TripJack's location APIs before re-quoting.
    const [origin, destination] = await Promise.all([
      ensureLocationAddress(routeDetail.origin),
      ensureLocationAddress(routeDetail.destination),
    ]);

    const quoteRequest: QuoteRequest = {
      pickupDate: toQuoteDate(journeyInfo.pickupDateTime),
      ...(journeyInfo.returnDateTime
        ? { returnDate: toQuoteDate(journeyInfo.returnDateTime) }
        : {}),
      origin,
      destination,
      journeyType,
      tripType,
      passengers,
      quoteFilter: { paxCount: passengers },
    };

    const supplier = cabSupplierRegistry.getByCode("TJ");
    if (!supplier) {
      throw new StructuredError("SUPPLIER_ERROR", "No cab supplier is registered.");
    }

    const payload: CabPrecheckPayload = {
      quoteRequest,
      vehicleType: String(quotationInfo.vehicleType || ""),
      vehicleCategory: String(quotationInfo.vehicleCategory || ""),
    };

    const fresh = await supplier.adapter.precheck(payload);

    const expected: ExpectedCab = {
      vehicleType: quotationInfo.vehicleType,
      vehicleCategory: quotationInfo.vehicleCategory,
      price:
        pricingInfo.grossAmount !== undefined
          ? Number(pricingInfo.grossAmount)
          : undefined,
    };

    const { price } = ValidationEngine.validate(
      expected,
      fresh,
      env.priceTolerance,
    );

    return { fresh, validatedPrice: price };
  }
}

export const precheckService = new PrecheckService();
