import { HotelSupplierAdapter } from "../types";
import { searchTJ } from "../../adapters/tripJackAdapter";
import { tripJackProvider } from "../../providers/tripjack.provider";
import { supplierRegistry } from "../registry";

/**
 * TripJack supplier descriptor — a thin composition over the existing,
 * already-verified searchTJ()/tripJackProvider. No TJ-specific logic lives
 * here; this file only maps that existing logic onto the common interface.
 */
export const tripJackSupplier: HotelSupplierAdapter = {
  code: "TJ",

  isDirectMatch: (destination) =>
    destination.startsWith("TJ:") || /^\d{8,15}$/.test(destination.trim()),

  // Reproduces the exact original products.service.ts#isTripJack() predicate:
  // TJ if explicit "TJ:" prefix, or (not "RG:", not a UUID, and all-digits).
  ownsPropertyId: (propertyId) => {
    if (propertyId.startsWith("TJ:")) return true;
    if (propertyId.startsWith("RG:")) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(propertyId)) return false;
    return /^\d+$/.test(propertyId);
  },

  // TripJack search doesn't use clientType today; kept in the signature for interface parity.
  search: (req, _clientType) => searchTJ(req),

  getProducts: (payload) => tripJackProvider.getProducts(payload),
};

supplierRegistry.register(tripJackSupplier);
