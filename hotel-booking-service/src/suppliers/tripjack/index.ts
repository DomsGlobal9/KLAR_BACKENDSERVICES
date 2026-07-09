import { tripJackAdapter } from "../../adapters/tripjack.adapter";
import { bookingSupplierRegistry } from "../registry";
import { BookingSupplier } from "../types";

export const tripJackBookingSupplier: BookingSupplier = {
  code: "TJ",
  adapter: tripJackAdapter,
};

bookingSupplierRegistry.register(tripJackBookingSupplier);
