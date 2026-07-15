import { HotelSupplierAdapter } from "../types";
import { searchRG } from "../../adapters/rateGainAdapter";
import { rateGainProvider } from "../../providers/rategain.provider";
import { supplierRegistry } from "../registry";

/**
 * RateGain supplier descriptor — a thin composition over the existing,
 * already-verified searchRG()/rateGainProvider. No RG-specific logic lives
 * here; this file only maps that existing logic onto the common interface.
 */
export const rateGainSupplier: HotelSupplierAdapter = {
  code: "RG",

  isDirectMatch: (destination) => destination.startsWith("RG:"),

  // Catch-all default: mirrors products.service.ts's original
  // `isTripJack() === false` fallback. MUST be registered after tripJackSupplier
  // (see suppliers/index.ts) so TJ's specific predicate is checked first.
  ownsPropertyId: () => true,

  search: (req, clientType) => searchRG(req, clientType),

  getProducts: (payload) => rateGainProvider.getAllProducts(payload),
};

supplierRegistry.register(rateGainSupplier);
