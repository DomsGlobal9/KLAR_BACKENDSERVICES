import { rateGainAdapter } from "../../adapters/rategain.adapter";
import { bookingSupplierRegistry } from "../registry";
import { BookingSupplier } from "../types";

export const rateGainBookingSupplier: BookingSupplier = {
  code: "RG",
  adapter: rateGainAdapter,
};

bookingSupplierRegistry.register(rateGainBookingSupplier);
