import { SupplierAdapter } from "../models/PrecheckResult";

/**
 * A cab supplier registered in the registry. Reuses the SupplierAdapter
 * contract (precheck/commit/cancel/pollStatus) so the booking layer can stay
 * supplier-agnostic. Mirrors hotel-booking-service's BookingSupplier.
 */
export interface CabSupplier {
  /** Short code, e.g. "TJ" (TripJack). */
  code: string;
  adapter: SupplierAdapter;
}
