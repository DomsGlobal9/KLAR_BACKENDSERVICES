import {
  tripJackHmsClient,
  tripJackOmsClient,
} from "../clients/tripjack.client";
import { v4 as uuidv4 } from "uuid";

export class TripJackApiProvider {
  /**
   * POST /hms/v3/hotel/review
   * Validates the selected option. Returns bookingId needed for the Book API.
   * Must be called IMMEDIATELY before Book.
   *
   * Required fields per docs:
   *   correlationId, optionId, reviewHash, hid
   */
  async precheck(payload: any) {
    console.log(
      "[TripJackProvider] Precheck payload received by provider:",
      JSON.stringify(payload, null, 2),
    );

    const {
      hid: topHid,
      propertyID: topPropertyID,
      propertyId: topPropertyId,
      reviewHash: topReviewHash,
      correlationId: topCorrelationId,
      optionId: topOptionId,
      RoomSelection,
    } = payload;

    // Fallback extraction
    const hid =
      topHid ||
      topPropertyId ||
      topPropertyID ||
      RoomSelection?.[0]?.hid ||
      RoomSelection?.[0]?.tjHotelId ||
      "";
    const reviewHash =
      topReviewHash ||
      RoomSelection?.[0]?.reviewHash ||
      RoomSelection?.[0]?.ReviewHash ||
      RoomSelection?.[0]?.review_hash ||
      "";
    const correlationId =
      topCorrelationId ||
      RoomSelection?.[0]?.correlationId ||
      RoomSelection?.[0]?.CorrelationId ||
      RoomSelection?.[0]?._correlationId ||
      "";
    const optionId =
      topOptionId ||
      RoomSelection?.[0]?.optionId ||
      RoomSelection?.[0]?.rateKey ||
      RoomSelection?.[0]?.RoomSelectionKey ||
      "";

    console.log(
      `[TripJackProvider] Extracted metadata - hid: ${hid}, reviewHash: ${reviewHash}, correlationId: ${correlationId}, optionId: ${optionId}`,
    );

    // FIX #4: hid is required by TripJack Review API
    if (!optionId) throw new Error("[TripJack Review] optionId is required");
    if (!reviewHash)
      throw new Error("[TripJack Review] reviewHash is required");
    if (!hid) throw new Error("[TripJack Review] hid is required");
    if (!correlationId)
      throw new Error(
        "[TripJack Review] correlationId is required for v3 state tracking",
      );

    const cleanHid =
      typeof hid === "string"
        ? hid.replace("TJ:", "").replace("RG:", "").trim()
        : hid;
    const isNumericHid = typeof cleanHid === "string" && /^\d+$/.test(cleanHid);
    const finalHid = isNumericHid ? Number(cleanHid) : cleanHid;

    const tjPayload = {
      correlationId,
      optionId,
      reviewHash,
      hid: finalHid,
    };

    try {
      console.log(
        `[TripJack] Sending v3 Review Request to HMS:`,
        JSON.stringify(tjPayload, null, 2),
      );
      const serializedReviewPayload = JSON.stringify(tjPayload);
      console.log(
        `[NETWORK BOUNDARY] TripJack HMS Review Request Serialized Payload: ${serializedReviewPayload}`,
      );

      const res = await tripJackHmsClient.post(
        "/hms/v3/hotel/review",
        tjPayload,
      );

      const data = res.data;

      // FIX: Override response IDs to match requested IDs to prevent mismatch in booking flow
      const originalHotelId = topPropertyId || topPropertyID || topHid || hid;

      if (data?.hotelId) data.hotelId = originalHotelId;
      if (data?.optionId) data.optionId = optionId;

      if (data?.hotel) {
        if (data.hotel.hotelId) data.hotel.hotelId = originalHotelId;
        if (data.hotel.optionId) data.hotel.optionId = optionId;
      }
      if (data?.option) {
        if (data.option.optionId) data.option.optionId = optionId;
      }

      // Check for internal TripJack errors (False Positives)
      if (data?.status?.success === false) {
        const errorMsg =
          data.errors?.[0]?.message ||
          data.status?.description ||
          "TripJack Review Internal Error";
        console.error(
          `[TripJack] Review Internal Failure: ${errorMsg}`,
          JSON.stringify(data.errors),
        );
        throw {
          response: {
            status: 400,
            data: data,
          },
        };
      }

      // bookingId is returned at top level — needed for the Book API
      const bookingId: string = data.bookingId || "";

      return {
        status: true,
        statusCode: 200,
        description: "TripJack Review Success",
        bookingId, // ← expose at top level for the frontend
        hotelId: originalHotelId,
        optionId: optionId,
        body: data,
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage =
        typeof errorData === "string"
          ? errorData.substring(0, 500)
          : JSON.stringify(errorData || {}).substring(0, 500);
      console.error(
        "[TripJack] Review Error:",
        error.response?.status,
        errorMessage,
      );

      // Log full error for deep debugging if needed
      if (error.response?.data) {
        console.error(
          "[TripJack-DEBUG] Full HMS Error Response:",
          JSON.stringify(error.response.data, null, 2),
        );
      }

      // Return exactly what TJ sent us so frontend/test-script can see it
      throw {
        response: {
          status: error.response?.status || 500,
          data: error.response?.data || { description: error.message },
        },
      };
    }
  }

  private static mapTripJackTravellers(roomTravellerInfo: any[]) {
    return roomTravellerInfo?.map((room: any) => {
      if (!room.travellerInfo) return room;
      return {
        travellerInfo: room.travellerInfo.map(
          (traveller: any, index: number) => {
            const rawFN = (traveller.fN || traveller.firstName || "Guest")
              .toString()
              .replace(/[^a-zA-Z]/g, "");
            const rawLN = (traveller.lN || traveller.lastName || "User")
              .toString()
              .replace(/[^a-zA-Z]/g, "");

            const capsFN = rawFN.toUpperCase();
            const capsLN = rawLN.toUpperCase();
            const sentFN =
              rawFN.charAt(0).toUpperCase() + rawFN.slice(1).toLowerCase();
            const sentLN =
              rawLN.charAt(0).toUpperCase() + rawLN.slice(1).toLowerCase();

            const titleMap: Record<string, string> = {
              MR: "Mr",
              MRS: "Mrs",
              MS: "Ms",
              MISS: "Miss",
              MASTER: "Master",
              MSTR: "Master",
            };
            const inputTi = (traveller.ti || traveller.title || "Mr")
              .replace(/\./g, "")
              .trim()
              .toUpperCase();
            const ti = titleMap[inputTi] || "Mr";
            const pt = (traveller.pt || traveller.paxType || "ADULT")
              .trim()
              .toUpperCase();

            const mappedTraveller: any = {
              fN: capsFN,
              lN: capsLN,
              ti: ti,
              pt: pt,
            };

            if (index === 0) {
              mappedTraveller.isLeadGuest = true;
            }

            if (pt === "ADULT") {
              if (traveller.pan)
                mappedTraveller.pan = traveller.pan
                  .replace(/\s+/g, "")
                  .trim()
                  .toUpperCase();
              if (traveller.pNum)
                mappedTraveller.pNum = traveller.pNum
                  .replace(/\s+/g, "")
                  .trim()
                  .toUpperCase();
            } else if (pt === "CHILD" && traveller.age) {
              mappedTraveller.age = Number(traveller.age);
            }
            return mappedTraveller;
          },
        ),
      };
    });
  }

  /**
   * POST /oms/v3/hotel/book
   *
   * FIX #5: Completely rewritten to match TripJack v3 schema.
   * - bookingId comes from Review response (NOT generated by us)
   * - uses roomTravellerInfo (NOT roomsInfo/travellerInfo)
   * - requires deliveryInfo (emails, contacts, code)
   * - requires type: "HOTEL"
   * - paymentInfos present = Instant, absent = Hold
   */
  async commit(payload: any) {
    const {
      bookingId,
      type,
      roomTravellerInfo,
      deliveryInfo,
      paymentInfos,
      gstInfo,
    } = payload;

    if (!bookingId) throw new Error("[TripJack Book] bookingId is required");

    const mappedRoomTravellerInfo =
      TripJackApiProvider.mapTripJackTravellers(roomTravellerInfo);

    const tjPayload: any = {
      bookingId,
      type: "HOTEL",
      roomTravellerInfo: mappedRoomTravellerInfo,
      deliveryInfo: {
        emails: deliveryInfo?.emails || [],
        contacts: deliveryInfo?.contacts || [],
        code: (deliveryInfo?.code || ["+91"]).map((c: string) =>
          c.startsWith("+") ? c : `+${c}`,
        ),
      },
    };

    if (gstInfo?.gstNumber) {
      tjPayload.gstInfo = {
        gstNumber: gstInfo.gstNumber.trim().toUpperCase(),
        registeredName: (
          gstInfo.registeredName ||
          gstInfo.companyName ||
          "KLAR"
        ).trim(),
      };
      console.log(
        `[TripJack] Book: Including gstInfo for GST passthrough:`,
        tjPayload.gstInfo,
      );
    }

    if (paymentInfos && paymentInfos.length > 0) {
      tjPayload.paymentInfos = paymentInfos;
    }

    console.log(
      `[TripJack] Book Request (${bookingId}):`,
      JSON.stringify(tjPayload, null, 2),
    );
    const serializedBookPayload = JSON.stringify(tjPayload);
    console.log(
      `[NETWORK BOUNDARY] TripJack Book Request Serialized Payload: ${serializedBookPayload}`,
    );

    try {
      const res = await tripJackOmsClient.post("/oms/v3/hotel/book", tjPayload);
      const data = res.data;
      console.log(
        `[TripJack] Book Response (${bookingId}):`,
        JSON.stringify(data, null, 2),
      );

      if (data?.status?.success === false) {
        let errDesc =
          data.errors?.[0]?.message ||
          data.status?.description ||
          "Booking Failed";
        if (errDesc.toLowerCase().includes("insufficient balance")) {
          errDesc =
            "TripJack Provider Wallet Insufficient Balance: Your upstream B2B API account on TripJack lacks sufficient deposit/credit limit to complete this instant booking.";
        }
        return {
          status: false,
          statusCode: 400,
          description: errDesc,
          body: data,
        };
      }

      return {
        status: true,
        statusCode: 200,
        description: "TripJack Book Success",
        bookingId: data.bookingId || bookingId,
        body: data,
      };
    } catch (error: any) {
      const errorData = error.response?.data || { message: error.message };
      console.error(
        `[TripJack] Book API Error (${bookingId}):`,
        JSON.stringify(errorData, null, 2),
      );

      let errorMessage =
        errorData?.errors?.[0]?.message ||
        errorData?.status?.description ||
        errorData?.description ||
        errorData?.message ||
        (typeof errorData === "string" ? errorData : "Request failed");

      if (errorMessage.toLowerCase().includes("insufficient balance")) {
        errorMessage =
          "TripJack Provider Wallet Insufficient Balance: Your upstream B2B API account on TripJack lacks sufficient deposit/credit limit to complete this instant booking.";
      }

      return {
        status: false,
        statusCode: error.response?.status || 500,
        description: errorMessage,
        body: errorData,
      };
    }
  }

  /**
   * POST /oms/v3/hotel/confirm-book
   * Confirm a previously HELD booking before the deadline.
   */
  async confirmBook(payload: any) {
    const { bookingId, paymentInfos } = payload;

    if (!bookingId) throw new Error("[TripJack Confirm] bookingId is required");
    if (!paymentInfos?.length)
      throw new Error(
        "[TripJack Confirm] paymentInfos (amount) is required for confirmation",
      );

    const tjPayload = {
      bookingId,
      paymentInfos,
    };

    try {
      console.log(
        `[TripJack] Confirm Book Request:`,
        JSON.stringify(tjPayload, null, 2),
      );
      const res = await tripJackOmsClient.post(
        "/oms/v3/hotel/confirm-book",
        tjPayload,
      );
      return res.data;
    } catch (error: any) {
      console.error(
        "[TripJack] Confirm Book Error:",
        error.response?.status,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * POST /oms/v3/hotel/booking-details
   * Poll every 5s up to 180s after Book call.
   * Terminal states: SUCCESS, ON_HOLD, ABORTED, FAILED, CANCELLED
   */
  async getBookingDetails(bookingId: string): Promise<any> {
    try {
      const res = await tripJackOmsClient.post(
        "/oms/v3/hotel/booking-details",
        { bookingId },
      );
      return res.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`[TripJack] v3 booking-details 404, falling back to v1...`);
        try {
          const resV1 = await tripJackOmsClient.post(
            "/oms/v1/hotel/booking-details",
            { bookingId },
          );
          return resV1.data;
        } catch (errV1: any) {
          throw errV1;
        }
      }
      const errorData = error.response?.data;
      const errorMessage =
        typeof errorData === "string"
          ? errorData.substring(0, 500)
          : JSON.stringify(errorData || {}).substring(0, 500);
      console.error("[TripJack] GetBookingDetails Error:", errorMessage);
      throw error;
    }
  }

  /**
   * POST /oms/v3/hotel/cancel-booking/{bookingId}
   * Supports both v3 and v1 paths gracefully.
   */
  async cancel(bookingId: string): Promise<any> {
    try {
      console.log(`[TripJack] Cancelling booking: ${bookingId}`);
      try {
        const res = await tripJackOmsClient.post(
          `/oms/v3/hotel/cancel-booking/${bookingId}`,
        );
        return {
          status: true,
          statusCode: 200,
          description: "TripJack Cancel Success",
          body: res.data,
        };
      } catch (errV3: any) {
        if (errV3.response?.status === 404) {
          console.log(
            `[TripJack] v3 cancel-booking 404, falling back to v1...`,
          );
          const resV1 = await tripJackOmsClient.post(
            `/oms/v1/hotel/cancel-booking/${bookingId}`,
          );
          return {
            status: true,
            statusCode: 200,
            description: "TripJack Cancel Success",
            body: resV1.data,
          };
        }
        throw errV3;
      }
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage =
        typeof errorData === "string"
          ? errorData.substring(0, 500)
          : JSON.stringify(errorData || {}).substring(0, 500);
      console.error("[TripJack] Cancel Error:", errorMessage);
      throw error;
    }
  }

  /**
   * POST /oms/v3/hotel/amend-charges
   */
  async getAmendCharges(payload: any): Promise<any> {
    try {
      console.log(
        `[TripJack] Fetching Amendment Charges for: ${payload.bookingId}`,
      );
      const res = await tripJackOmsClient.post(
        "/oms/v3/hotel/amend-charges",
        payload,
      );
      return res.data;
    } catch (error: any) {
      console.error(
        "[TripJack] AmendCharges Error:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * POST /oms/v3/hotel/amend
   * Commit the amendment request.
   */
  async amend(payload: any): Promise<any> {
    try {
      console.log(`[TripJack] Committing Amendment for: ${payload.bookingId}`);
      const res = await tripJackOmsClient.post("/oms/v3/hotel/amend", payload);
      return res.data;
    } catch (error: any) {
      console.error(
        "[TripJack] Amend Commit Error:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
