import { rateGainClient } from "../clients/rategain.client";

export class RateGainApiProvider {
  /**
   * POST /api/SmartDistribution/PreCheckReservation
   * Validate rate and availability before committing a booking.
   */
  async precheck(payload: any) {
    const booking = payload.BookReservation || payload;
    const rawPropertyId = (
      booking.propertyID ||
      booking.PropertyId ||
      booking.propertyId ||
      booking.PropertyCode ||
      ""
    )
      .toString()
      .replace(/^RG:/, "");
    const consolidatedPayload = {
      BookReservation: {
        ResStatus: booking.ResStatus || 1,
        CurrencyCode: booking.CurrencyCode || booking.Currency || "USD",
        GuaranteeMethod: booking.GuaranteeMethod || "CreditCard",
        GuaranteeType: booking.GuaranteeType || "Guarantee",
        propertyID: rawPropertyId,
        PropertyId: rawPropertyId,
        PropertyCode: booking.PropertyCode || rawPropertyId,
        BrandCode: booking.BrandCode || booking.brandCode || "N/A",
        checkin: booking.checkin || booking.checkIn,
        checkout: booking.checkout || booking.checkOut,
        CountryCode: booking.CountryCode || "IN",
        Currency: booking.Currency || booking.CurrencyCode || "INR",
        EchoToken:
          booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
        Session: booking.Session || "",
        RoomSelection: (booking.RoomSelection || []).map((rs: any) => {
          const mappedRs: any = {
            RoomTypeCode: rs.RoomTypeCode || "Standard",
            NumberOfRooms: rs.NumberOfRooms || rs.numberOfRooms || 1,
            NumberOfAdults: rs.NumberOfAdults || rs.numberOfAdults || 2,
            NumberOfChild: rs.NumberOfChild || rs.numberOfChild || 0,
            RoomSelectionKey: rs.RoomSelectionKey || "",
            RoomRate: rs.RoomRate || 0,
            BoardName: rs.BoardName || "ROOM ONLY",
            Guest: (rs.Guest || []).map((g: any) => ({
              FirstName: g.FirstName || "Guest",
              LastName: g.LastName || "Guest",
              Primary: g.Primary !== false,
              Email: g.Email || "[EMAIL_ADDRESS]",
              EmailType: g.EmailType || 1,
              ProfileType: g.ProfileType || 1,
              Phone: g.Phone || "0000000000",
              Line1: g.Line1 || "N/A",
              City: g.City || "N/A",
              StateCode: g.StateCode || "TN",
              CountryCode: g.CountryCode || "IN",
              PostalCode: g.PostalCode || "600001",
            })),
          };
          if (rs.allocationDetails)
            mappedRs.allocationDetails = rs.allocationDetails;
          if (rs.Children && rs.Children.length > 0) {
            mappedRs.Children = rs.Children.map((c: any) => ({
              type: "Child",
              age: c.age || 5,
            }));
          }
          if (rs.SpecialRequest) mappedRs.SpecialRequest = rs.SpecialRequest;
          if (rs.Comment) mappedRs.Comment = rs.Comment;
          return mappedRs;
        }),
      },
    };

    try {
      console.log(
        `[RateGain] Requesting PreCheck: ${JSON.stringify(consolidatedPayload, null, 2)}`,
      );
      const response = await rateGainClient.post(
        "/api/SmartDistribution/PreCheckReservation",
        consolidatedPayload,
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[RateGain] PreCheck Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }

  /**
   * POST /api/SmartDistribution/CommitReservation
   * Finalize and commit a hotel reservation.
   */
  async commit(payload: any) {
    const booking = payload.BookReservation || payload;
    const now = new Date().toISOString();

    const rawPropertyId = (
      booking.propertyID ||
      booking.PropertyId ||
      booking.propertyId ||
      booking.PropertyCode ||
      ""
    )
      .toString()
      .replace(/^RG:/, "");
    const consolidatedPayload = {
      BookReservation: {
        ResStatus: booking.ResStatus || 1,
        CurrencyCode: booking.CurrencyCode || booking.Currency || "USD",
        GuaranteeMethod: booking.GuaranteeMethod || "CreditCard",
        GuaranteeType: booking.GuaranteeType || "Guarantee",
        propertyID: rawPropertyId,
        PropertyId: rawPropertyId,
        PropertyCode: booking.PropertyCode || rawPropertyId,
        BrandCode: booking.BrandCode || booking.brandCode || "N/A",
        checkin: booking.checkin || booking.checkIn,
        checkout: booking.checkout || booking.checkOut,
        CountryCode: booking.CountryCode || "US",
        Currency: booking.Currency || booking.CurrencyCode || "USD",
        DemandBookingId: booking.DemandBookingId || `demand-${Date.now()}`,
        ReservationDate: booking.ReservationDate || now,
        TimeStamp: booking.TimeStamp || now,
        EchoToken:
          booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
        Session: booking.Session || "",
        SellingRate:
          booking.SellingRate !== undefined
            ? booking.SellingRate
            : booking.sellingRate !== undefined
              ? booking.sellingRate
              : booking.BookingRate,
        BookingRate:
          booking.BookingRate !== undefined
            ? booking.BookingRate
            : booking.SellingRate !== undefined
              ? booking.SellingRate
              : booking.sellingRate,
        sellingRate:
          booking.sellingRate !== undefined
            ? booking.sellingRate
            : booking.SellingRate !== undefined
              ? booking.SellingRate
              : booking.BookingRate,
        RoomSelection: (booking.RoomSelection || []).map((rs: any) => {
          const mappedRs: any = {
            RoomTypeCode: rs.RoomTypeCode || "Standard",
            NumberOfRooms: rs.NumberOfRooms || rs.numberOfRooms || 1,
            NumberOfAdults: rs.NumberOfAdults || rs.numberOfAdults || 2,
            NumberOfChild: rs.NumberOfChild || rs.numberOfChild || 0,
            RoomSelectionKey: rs.RoomSelectionKey || "",
            RoomRate: rs.RoomRate || 0,
            BoardName: rs.BoardName || "ROOM ONLY",
            Guest: (rs.Guest || []).map((g: any) => ({
              FirstName: g.FirstName || "Guest",
              LastName: g.LastName || "Guest",
              Primary: g.Primary !== false,
              Email: g.Email || "guest@example.com",
              EmailType: g.EmailType || 1,
              ProfileType: g.ProfileType || 1,
              Phone: g.Phone || "0000000000",
              Line1: g.Line1 || "N/A",
              City: g.City || "N/A",
              StateCode: g.StateCode || "N/A",
              CountryCode: g.CountryCode || "US",
              PostalCode: g.PostalCode || "00000",
            })),
          };
          if (rs.allocationDetails)
            mappedRs.allocationDetails = rs.allocationDetails;
          if (rs.Children && rs.Children.length > 0) {
            mappedRs.Children = rs.Children.map((c: any) => ({
              type: "Child",
              age: c.age || 5,
            }));
          }
          if (rs.SpecialRequest) mappedRs.SpecialRequest = rs.SpecialRequest;
          if (rs.Comment) mappedRs.Comment = rs.Comment;
          return mappedRs;
        }),
      },
    };

    try {
      console.log(
        `[RateGain] Requesting Commit: ${JSON.stringify(consolidatedPayload, null, 2)}`,
      );
      const response = await rateGainClient.post(
        "/api/SmartDistribution/CommitReservation",
        consolidatedPayload,
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[RateGain] Commit Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }

  /**
   * POST /api/SmartDistribution/CancelReservation
   * Cancel an existing hotel reservation.
   */
  async cancel(payload: any) {
    const booking = payload.CancelReservation || payload;
    const rawPropertyId = (
      booking.PropertyId ||
      booking.propertyId ||
      booking.propertyID ||
      ""
    )
      .toString()
      .replace(/^RG:/, "");

    const unwrappedPayload = {
      ConfirmationNumber:
        booking.ConfirmationNumber ||
        booking.confirmationNumber ||
        booking.confirmationId,
      ReservationId:
        booking.ReservationId || booking.reservationId || booking.reservationid,
      DemandCancelId: booking.DemandCancelId || `demand-cancel-${Date.now()}`,
      TimeStamp: booking.TimeStamp || new Date().toISOString(),
      EchoToken: booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
      BrandCode:
        booking.BrandCode && booking.BrandCode !== "N/A"
          ? booking.BrandCode
          : "TkEvQQ==",
      PropertyCode: booking.PropertyCode || rawPropertyId || "N/A",
      PropertyId: rawPropertyId,
    };

    try {
      console.log(
        `[RateGain] Requesting Cancel: ${JSON.stringify(unwrappedPayload, null, 2)}`,
      );
      const response = await rateGainClient.post(
        "/api/SmartDistribution/CancelReservation",
        unwrappedPayload,
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[RateGain] Cancel Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }

  /**
   * GET /api/SmartDistribution/getSpecialRequests
   * Get list of predefined special request codes.
   */
  async getSpecialRequests() {
    try {
      const response = await rateGainClient.get(
        "/api/SmartDistribution/getSpecialRequests",
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[RateGain] SpecialRequests Error:",
        error.response?.status,
        error.response?.data?.description || error.message,
      );
      throw error;
    }
  }
}
