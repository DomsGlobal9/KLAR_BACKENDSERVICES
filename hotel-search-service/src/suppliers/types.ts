import { UnifiedSearchRequest, UnifiedHotel } from "../types/unified";

/**
 * Contract every hotel supplier (RateGain, TripJack, and any future supplier)
 * must implement to plug into search + product-details WITHOUT touching the
 * orchestrators (services/hotels.service.ts, services/products.service.ts).
 *
 * To add a new supplier:
 *   1. Create suppliers/<name>/index.ts exporting an object of this shape.
 *   2. Register it in suppliers/index.ts (registration order matters — see
 *      the comment there about ownsPropertyId()'s "first match wins" rule).
 *   3. Add HOTEL_PROVIDER_MODE support for "<CODE>_ONLY" if needed (optional —
 *      "UNIFIED" mode already includes every registered supplier automatically).
 * No other file needs to change.
 */
export interface HotelSupplierAdapter {
  /** Short code used in HOTEL_PROVIDER_MODE (e.g. "RG_ONLY") and the `providers` search filter. */
  code: string;

  /**
   * True if a raw `destination` string is a direct reference to this supplier
   * (e.g. "RG:xxx", "TJ:123456", or a bare numeric TripJack hid).
   */
  isDirectMatch(destination: string): boolean;

  /**
   * True if a `propertyId` (as used by the /products endpoint) belongs to this
   * supplier. The registry checks suppliers in registration order and takes the
   * first match, so a supplier can implement this as a catch-all default by
   * always returning true (see suppliers/rategain/index.ts).
   */
  ownsPropertyId(propertyId: string): boolean;

  /**
   * Fan out a unified search request to this supplier.
   *
   * `total` is a supplier-specific upper bound, not a count of bookable hotels:
   * TripJack reports how many property ids fell inside the search radius, most
   * of which have no availability. Never surface it to a user, and never sum it
   * across suppliers — deduplication merges the overlap.
   *
   * `hasMore` is the authoritative "is there another page" signal.
   */
  search(
    req: UnifiedSearchRequest,
    clientType: "B2B" | "B2C",
  ): Promise<{ hotels: UnifiedHotel[]; total: number; hasMore: boolean }>;

  /** Room/rate-level product details for a specific property. */
  getProducts(payload: any): Promise<any>;
}
