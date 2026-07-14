import { tripJackCabsAdapter } from "../../adapters/tripjack.cabs.adapter";
import { cabSupplierRegistry } from "../registry";
import { CabSupplier } from "../types";

export const tripJackCabSupplier: CabSupplier = {
  code: "TJ",
  adapter: tripJackCabsAdapter,
};

cabSupplierRegistry.register(tripJackCabSupplier);
