import { HotelSupplierAdapter } from "./types";

class SupplierRegistry {
  private suppliers: HotelSupplierAdapter[] = [];

  /** Called once per supplier at module-load time (see each suppliers/<name>/index.ts). */
  register(supplier: HotelSupplierAdapter): void {
    this.suppliers.push(supplier);
  }

  /** All registered suppliers, in registration order. */
  all(): HotelSupplierAdapter[] {
    return this.suppliers;
  }

  /** True if `destination` is a direct reference to ANY registered supplier. */
  isDirectSearch(destination: string): boolean {
    return this.suppliers.some((s) => s.isDirectMatch(destination));
  }

  /**
   * Suppliers allowed by HOTEL_PROVIDER_MODE ("UNIFIED" | "<CODE>_ONLY") and
   * direct-search targeting, BEFORE the per-request `providers` filter is
   * applied. Exposed separately so callers can log which suppliers were
   * excluded specifically by the `providers` filter (vs. by mode/direct-search).
   */
  getModeAndDirectEligible(mode: string, destination: string): HotelSupplierAdapter[] {
    const direct = this.isDirectSearch(destination);
    return this.suppliers.filter((s) => {
      const modeAllows = mode === "UNIFIED" || mode === `${s.code}_ONLY`;
      if (!modeAllows) return false;
      if (direct && !s.isDirectMatch(destination)) return false;
      return true;
    });
  }

  /** Final set of suppliers to actually query for a given search request. */
  getEnabled(opts: {
    mode: string;
    destination: string;
    requestedCodes?: string[];
  }): HotelSupplierAdapter[] {
    const eligible = this.getModeAndDirectEligible(opts.mode, opts.destination);
    if (!opts.requestedCodes || opts.requestedCodes.length === 0) return eligible;
    return eligible.filter((s) => opts.requestedCodes!.includes(s.code));
  }

  /**
   * Which supplier owns a propertyId (used to route /products requests).
   * Checks suppliers in registration order and returns the FIRST match —
   * a supplier can act as the default/catch-all by always returning true
   * from ownsPropertyId() (see suppliers/rategain/index.ts). Registration
   * order in suppliers/index.ts therefore matters: specific-match suppliers
   * must be registered before any catch-all supplier.
   */
  resolveByPropertyId(propertyId: string): HotelSupplierAdapter | null {
    return this.suppliers.find((s) => s.ownsPropertyId(propertyId)) || null;
  }
}

export const supplierRegistry = new SupplierRegistry();
