import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";

class PrecheckService {
  async precheck(payload: any) {
    const propertyId: string =
      payload.propertyId ||
      payload.PropertyId ||
      payload.BookReservation?.propertyID ||
      "";

    if (propertyId.startsWith("TJ:")) {
      // TripJack Review flow
      // Frontend might wrap in BookReservation (RateGain style)
      const tjPayload = payload.BookReservation || payload;
      console.log(
        "[TripJack Precheck] Raw payload received:",
        JSON.stringify(payload, null, 2),
      );
      console.log(
        "[TripJack Precheck] Unwrapped payload to provider:",
        JSON.stringify(tjPayload, null, 2),
      );
      return tripJackProvider.precheck(tjPayload);
    }

    // Default: RateGain PreCheckReservation
    return rateGainProvider.precheck(payload);
  }
}

export const precheckService = new PrecheckService();
