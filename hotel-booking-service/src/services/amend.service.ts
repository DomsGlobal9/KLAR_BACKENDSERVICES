import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { tripJackProvider } from "../providers/tripjack.provider";

class AmendService {
  async getModificationPolicy(confirmationNumber: string) {
    if (!confirmationNumber)
      throw { status: 400, message: "ConfirmationNumber is required" };

    const booking = await hotelBookingRepository.findOne(
      { confirmationNumber },
      true,
    );
    if (!booking) throw { status: 404, message: "Booking not found" };

    // For RateGain, modificationPolicies are stored in the body of the response
    const rgPolicy =
      booking.rateGainResponse?.body?.modificationPolicies ||
      booking.rateGainResponse?.body?.booking?.modificationPolicies ||
      booking.rateGainResponse?.body?.preCheckResponse?.modificationPolicies;

    if (rgPolicy) {
      return {
        allowed: !!rgPolicy.modification,
        details: rgPolicy,
      };
    }

    return {
      allowed: false,
      message:
        "No specific modification policy found. Modification may not be available for this rate.",
    };
  }

  async getModificationPricing(payload: any) {
    const { confirmationNumber, checkIn, checkOut, rooms } = payload;
    const booking = await hotelBookingRepository.findOne({
      confirmationNumber,
    });
    if (!booking) throw { status: 404, message: "Booking not found" };

    if (booking.provider === "tripjack") {
      const tjPayload = {
        bookingId: booking.confirmationNumber,
        checkIn, // YYYY-MM-DD
        checkOut,
        roomTravellerInfo: rooms, // Needs mapping to TJ format
      };
      return await tripJackProvider.getAmendCharges(tjPayload);
    }

    // For RateGain, simulate pricing (usually modification is Cancel/Rebook)
    return {
      status: true,
      allowed: true,
      estimatedCharges: 0,
      message:
        "Modification request received. Standard rates will apply for new dates.",
    };
  }

  async commitModification(payload: any) {
    const { confirmationNumber, checkIn, checkOut } = payload;
    const booking = await hotelBookingRepository.findOne({
      confirmationNumber,
    });
    if (!booking) throw { status: 404, message: "Booking not found" };

    if (booking.provider === "tripjack") {
      // Actual TJ Amend Commit
      return await tripJackProvider.amend({
        bookingId: confirmationNumber,
        checkIn,
        checkOut,
      });
    }

    // RateGain Mock: Update dates in DB to reflect Oct modification
    console.log(
      `[RateGain Mock] Modifying booking ${confirmationNumber} to: ${checkIn} -> ${checkOut}`,
    );
    const updated = await hotelBookingRepository.findOneAndUpdate(
      { confirmationNumber },
      {
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        status: "CONFIRMED", // Ensure it stays confirmed
      },
      { new: true },
    );

    return {
      status: true,
      statusCode: 200,
      description: "Modification Successful (Simulated)",
      body: updated,
    };
  }
}

export const amendService = new AmendService();
