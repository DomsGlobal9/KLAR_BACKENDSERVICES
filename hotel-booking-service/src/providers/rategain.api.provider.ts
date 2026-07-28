import { rateGainClient } from "../clients/rategain.client";
import { env } from "../config/env";

export class RateGainApiProvider {
  /**
   * POST /api/SmartDistribution/PreCheckReservation
   * Validate rate and availability before committing a booking.
   */
  async precheck(payload: any) {
    let booking = payload.BookReservation || payload;
    if (booking.BookReservation) {
      booking = booking.BookReservation;
    }
    const rawPropertyId = (
      booking.propertyID ||
      booking.PropertyId ||
      booking.propertyId ||
      booking.PropertyCode ||
      ""
    )
      .toString()
      .replace(/^RG:/, "");
    const precheckGuestSeen = new Set<string>();
    const consolidatedPayload = {
      BookReservation: {
        ResStatus: booking.ResStatus || 1,
        ...(booking.GuaranteeMethod
          ? { GuaranteeMethod: booking.GuaranteeMethod }
          : {}),
        ...(booking.GuaranteeType
          ? { GuaranteeType: booking.GuaranteeType }
          : {}),
        ...(booking.CreditCard ? { CreditCard: booking.CreditCard } : {}),
        CurrencyCode: booking.CurrencyCode || booking.Currency || "USD",
        propertyID: booking.PropertyCode || rawPropertyId,
        PropertyId: booking.PropertyCode || rawPropertyId,
        PropertyCode: booking.PropertyCode || rawPropertyId,
        BrandCode:
          booking.BrandCode &&
          booking.BrandCode !== "N/A" &&
          booking.BrandCode !== ""
            ? booking.BrandCode
            : booking.brandCode &&
                booking.brandCode !== "N/A" &&
                booking.brandCode !== ""
              ? booking.brandCode
              : "TkEvQQ==",
        checkin: booking.checkin || booking.checkIn,
        checkout: booking.checkout || booking.checkOut,
        CheckInDate: booking.checkin || booking.checkIn,
        CheckOutDate: booking.checkout || booking.checkOut,
        checkInDate: booking.checkin || booking.checkIn,
        checkOutDate: booking.checkout || booking.checkOut,
        CountryCode: booking.CountryCode || "IN",
        Currency: booking.Currency || booking.CurrencyCode || "INR",
        DemandBookingId:
          booking.DemandBookingId || `demand-precheck-${Date.now()}`,
        ReservationDate: booking.ReservationDate || new Date().toISOString(),
        TimeStamp: booking.TimeStamp || new Date().toISOString(),
        EchoToken:
          booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
        Session: booking.Session || "",
        BookingRate:
          booking.BookingRate !== undefined
            ? booking.BookingRate
            : booking.SellingRate !== undefined
              ? booking.SellingRate
              : booking.sellingRate,
        ...(booking.SellingRate !== undefined && booking.SellingRate !== null
          ? { SellingRate: Number(Number(booking.SellingRate).toFixed(2)) }
          : booking.sellingRate !== undefined && booking.sellingRate !== null
            ? { SellingRate: Number(Number(booking.sellingRate).toFixed(2)) }
            : {}),
        RoomSelection: (booking.RoomSelection || []).map((rs: any) => {
          const mappedRs: any = {
            RoomTypeCode: rs.RoomTypeCode || "Standard",
            NumberOfRooms: rs.NumberOfRooms || rs.numberOfRooms || 1,
            NumberOfAdults: rs.NumberOfAdults || rs.numberOfAdults || 2,
            NumberOfChild: rs.NumberOfChild || rs.numberOfChild || 0,
            RoomSelectionKey: rs.RoomSelectionKey || "",
            RoomRate: Number(Number(rs.RoomRate || 0).toFixed(2)),
            BoardName: rs.BoardName || "ROOM ONLY",
            Guest: (rs.Guest || []).map((g: any) => {
              let fName = (g.FirstName || "Guest").replace(/[^a-zA-Z0-9]/g, "");
              let lName = (g.LastName || "Guest").replace(/[^a-zA-Z0-9]/g, "");

              if (!fName) fName = "Guest";
              if (!lName) lName = "Guest";

              let fullName = `${fName}${lName}`.toLowerCase();
              if (precheckGuestSeen.has(fullName)) {
                fName = `${fName}${precheckGuestSeen.size + 1}`;
                fullName = `${fName}${lName}`.toLowerCase();
              }
              precheckGuestSeen.add(fullName);

              return {
                FirstName: fName,
                LastName: lName,
                Primary: g.Primary !== false,
                Email: g.Email || "[EMAIL_ADDRESS]",
                EmailType: g.EmailType || 1,
                ProfileType: g.ProfileType || 1,
                Phone: g.Phone || "0000000000",
                // RG spec 1.5.3 (Guest Details, p.38-39) marks Line1 / City /
                // StateCode as Required=No. Omit them when the guest left them
                // blank rather than shipping "N/A" and a guessed "TN" into the
                // hotel's PMS as if they were real address data.
                ...(g.Line1 ? { Line1: g.Line1 } : {}),
                ...(g.City ? { City: g.City } : {}),
                ...(g.StateCode ? { StateCode: g.StateCode } : {}),
                // Required for the primary guest, so these keep a fallback.
                CountryCode: g.CountryCode || "IN",
                PostalCode: g.PostalCode || "600001",
              };
            }),
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
      console.log(
        `[RateGain] PreCheck RAW Response (status=${response.status}): ${JSON.stringify(response.data, null, 2)}`,
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[RateGain] PreCheck HTTP Error:",
        error.response?.status,
        JSON.stringify(error.response?.data || error.message, null, 2),
      );
      throw error;
    }
  }

  /**
   * POST /api/SmartDistribution/CommitReservation
   * Finalize and commit a hotel reservation.
   */
  async commit(payload: any) {
    let booking = payload.BookReservation || payload;
    if (booking.BookReservation) {
      booking = booking.BookReservation;
    }
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
    const commitGuestSeen = new Set<string>();
    const consolidatedPayload = {
      BookReservation: {
        ResStatus: booking.ResStatus || 1,
        ...(booking.GuaranteeMethod
          ? { GuaranteeMethod: booking.GuaranteeMethod }
          : {}),
        ...(booking.GuaranteeType
          ? { GuaranteeType: booking.GuaranteeType }
          : {}),
        ...(booking.CreditCard ? { CreditCard: booking.CreditCard } : {}),
        CurrencyCode: booking.CurrencyCode || booking.Currency || "USD",
        propertyID: booking.PropertyCode || rawPropertyId,
        PropertyId: booking.PropertyCode || rawPropertyId,
        PropertyCode: booking.PropertyCode || rawPropertyId,
        BrandCode:
          booking.BrandCode &&
          booking.BrandCode !== "N/A" &&
          booking.BrandCode !== ""
            ? booking.BrandCode
            : booking.brandCode &&
                booking.brandCode !== "N/A" &&
                booking.brandCode !== ""
              ? booking.brandCode
              : "TkEvQQ==",
        checkin: booking.checkin || booking.checkIn,
        checkout: booking.checkout || booking.checkOut,
        CheckInDate: booking.checkin || booking.checkIn,
        CheckOutDate: booking.checkout || booking.checkOut,
        checkInDate: booking.checkin || booking.checkIn,
        checkOutDate: booking.checkout || booking.checkOut,
        // Must match the PreCheck context (IN/INR) — the RoomSelectionKey is bound
        // to the country/currency it was issued under. A US default here against an
        // IN-issued key triggers RateGain errorCode 2004 "Room selection key is invalid".
        CountryCode: booking.CountryCode || "IN",
        Currency: booking.Currency || booking.CurrencyCode || "INR",
        DemandBookingId: booking.DemandBookingId || `demand-${Date.now()}`,
        ReservationDate: booking.ReservationDate || now,
        TimeStamp: booking.TimeStamp || now,
        EchoToken:
          booking.EchoToken || booking.Echotoken || `echo-${Date.now()}`,
        Session: booking.Session || "",
        BookingRate:
          booking.BookingRate !== undefined
            ? booking.BookingRate
            : booking.SellingRate !== undefined
              ? booking.SellingRate
              : booking.sellingRate,
        // Spec v1.5.3: B2C Net + Commission model requires SellingRate (the MSP
        // from precheck). Only sent when provided (B2C); omitted for B2B.
        ...(booking.SellingRate !== undefined && booking.SellingRate !== null
          ? { SellingRate: Number(Number(booking.SellingRate).toFixed(2)) }
          : booking.sellingRate !== undefined && booking.sellingRate !== null
            ? { SellingRate: Number(Number(booking.sellingRate).toFixed(2)) }
            : {}),
        RoomSelection: (booking.RoomSelection || []).map((rs: any) => {
          const mappedRs: any = {
            RoomTypeCode: rs.RoomTypeCode || "Standard",
            NumberOfRooms: rs.NumberOfRooms || rs.numberOfRooms || 1,
            NumberOfAdults: rs.NumberOfAdults || rs.numberOfAdults || 2,
            NumberOfChild: rs.NumberOfChild || rs.numberOfChild || 0,
            RoomSelectionKey: rs.RoomSelectionKey || "",
            RoomRate: Number(Number(rs.RoomRate || 0).toFixed(2)),
            BoardName: rs.BoardName || "ROOM ONLY",
            Guest: (rs.Guest || []).map((g: any) => {
              let fName = (g.FirstName || "Guest").replace(/[^a-zA-Z0-9]/g, "");
              let lName = (g.LastName || "Guest").replace(/[^a-zA-Z0-9]/g, "");

              if (!fName) fName = "Guest";
              if (!lName) lName = "Guest";

              let fullName = `${fName}${lName}`.toLowerCase();
              if (commitGuestSeen.has(fullName)) {
                fName = `${fName}${commitGuestSeen.size + 1}`;
                fullName = `${fName}${lName}`.toLowerCase();
              }
              commitGuestSeen.add(fullName);

              return {
                FirstName: fName,
                LastName: lName,
                Primary: g.Primary !== false,
                Email: g.Email || "guest@example.com",
                EmailType: g.EmailType || 1,
                ProfileType: g.ProfileType || 1,
                Phone: g.Phone || "0000000000",
                // RG spec 1.5.3 (Guest Details, p.38-39) marks Line1 / City /
                // StateCode as Required=No. Omit them when the guest left them
                // blank rather than shipping "N/A" and a guessed "TN" into the
                // hotel's PMS as if they were real address data.
                ...(g.Line1 ? { Line1: g.Line1 } : {}),
                ...(g.City ? { City: g.City } : {}),
                ...(g.StateCode ? { StateCode: g.StateCode } : {}),
                // Required for the primary guest, so these keep a fallback.
                CountryCode: g.CountryCode || "IN",
                PostalCode: g.PostalCode || "600001",
              };
            }),
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
      console.log(
        `[RateGain] Commit RAW Response (status=${response.status}): ${JSON.stringify(response.data, null, 2)}`,
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[RateGain] Commit HTTP Error:",
        error.response?.status,
        JSON.stringify(error.response?.data || error.message, null, 2),
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
    // Extract PropertyId UUID from any field: PropertyId, propertyId, propertyID, or hotelId (strip RG: prefix)
    const rawPropertyId = (
      booking.PropertyId ||
      booking.propertyId ||
      booking.propertyID ||
      booking.hotelId ||
      ""
    )
      .toString()
      .replace(/^RG:/, "");

    const brandCode =
      booking.BrandCode &&
      booking.BrandCode !== "N/A" &&
      booking.BrandCode !== ""
        ? booking.BrandCode
        : booking.brandCode &&
            booking.brandCode !== "N/A" &&
            booking.brandCode !== ""
          ? booking.brandCode
          : "TkEvQQ==";

    const propertyCode =
      booking.PropertyCode || booking.propertyCode || rawPropertyId || "N/A";

    console.log(
      `[RateGain Cancel] PropertyId="${rawPropertyId}", PropertyCode="${propertyCode}", BrandCode="${brandCode}"`,
    );

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
      Session: booking.Session || `klar-session-${Date.now()}`,
      BrandCode: brandCode,
      PropertyCode: propertyCode,
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
        error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message,
        "Payload Sent:",
        JSON.stringify(unwrappedPayload, null, 2),
      );
      throw error;
    }
  }

  /**
   * POST /api/SmartDistribution/GetReservation
   * Fetch the current status of an existing reservation by confirmationNumber / reservationId.
   * Used by the status-sync path to resolve MANUAL_REVIEW bookings.
   */
  async getReservationDetails(
    confirmationNumber: string,
    reservationId?: string,
    propertyId?: string,
    brandCode?: string,
  ) {
    const payload = {
      ConfirmationNumber: confirmationNumber,
      ...(reservationId ? { ReservationId: reservationId } : {}),
      ...(propertyId ? { PropertyId: propertyId.replace(/^RG:/, "") } : {}),
      ...(brandCode ? { BrandCode: brandCode } : {}),
      EchoToken: `echo-${Date.now()}`,
      TimeStamp: new Date().toISOString(),
    };

    try {
      console.log(
        `[RateGain] GetReservation request: ${JSON.stringify(payload)}`,
      );
      const response = await rateGainClient.post(
        "/api/SmartDistribution/GetReservation",
        payload,
      );
      console.log(
        `[RateGain] GetReservation response (status=${response.status}): ${JSON.stringify(response.data)}`,
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "[RateGain] GetReservation Error:",
        error.response?.status,
        error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message,
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
