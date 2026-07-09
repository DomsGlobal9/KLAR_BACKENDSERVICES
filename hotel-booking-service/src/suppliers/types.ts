import { SupplierAdapter } from "../models/PrecheckResult";

/**
 * A supplier registered in the booking-service supplier registry.
 * Reuses the existing `SupplierAdapter` contract from models/PrecheckResult.ts
 * (precheck/commit/cancel/pollStatus) — nothing new is invented here.
 *
 * SCOPE NOTE: only `precheck()` is currently uniform enough across suppliers to
 * route generically (tripjack.adapter.ts and rategain.adapter.ts both already
 * return the identical PrecheckResultV1 shape). `commit()`/`cancel()` are NOT
 * routed through this registry yet — see suppliers/README.md for why, and what
 * would be needed to safely do so.
 */
export interface BookingSupplier {
  /** Short code, e.g. "RG" | "TJ". */
  code: string;
  adapter: SupplierAdapter;
}
