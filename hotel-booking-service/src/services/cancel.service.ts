import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { BookingStatus, BookingProvider } from "../models/Booking.model";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";
import { refundService } from "./refund.service";
import { notificationService } from "./notification.service";

async function pollTripJackCancellationStatus(
  bookingId: string,
  query: any,
  cancelChargesInfo: any,
): Promise<void> {
  const POLL_INTERVAL_MS = 5000;
  const POLL_TIMEOUT_MS = 180000; // 3 minutes
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  const poll = async (): Promise<void> => {
    if (Date.now() >= deadline) {
      console.log(
        `[TripJack Cancel Poll] Deadline reached for booking: ${bookingId}. The status cron will keep trying.`,
      );
      return;
    }
    try {
      const details = await tripJackProvider.getBookingDetails(bookingId);
      const finalStatus = details?.order?.status || "PENDING";
      const apiSuccess = details?.status?.success === true;
      const isTerminal =
        finalStatus === "CANCELLED" ||
        finalStatus === "FAILED" ||
        finalStatus === "ABORTED";

      console.log(
        `[TripJack Cancel Poll] Status check for ${bookingId}: status=${finalStatus}, isTerminal=${isTerminal}`,
      );

      if (apiSuccess && isTerminal) {
        if (Object.keys(query).length === 0) return;

        await hotelBookingRepository.findOneAndUpdate(query, {
          tripJackResponse: details,
        });

        const booking = await hotelBookingRepository.findOne(query);
        if (!booking) return;

        if (finalStatus === "CANCELLED") {
          if (process.env.ENABLE_AUTO_REFUNDS === "false") {
            console.log(
              `[TripJack Cancel Poll] Auto-refund disabled. Marking ${bookingId} as CANCELLED. Pending manual CRM refund.`,
            );
            const updatedBooking =
              await hotelBookingRepository.findOneAndUpdate(
                { _id: booking._id },
                { status: BookingStatus.CANCELLED },
                { new: true },
              );
            if (updatedBooking) {
              notificationService.sendBookingStatusEmail(
                updatedBooking,
                BookingStatus.CANCELLED,
              );
            }
          } else {
            // refundCancelledBooking moves the booking to CANCELLED once the
            // money is provably back with the traveller.
            await refundService.settleCancellation(booking, cancelChargesInfo);
          }
        } else {
          // The supplier rejected the cancellation — the stay still stands.
          console.warn(
            `[TripJack Cancel Poll] ${bookingId} ended in ${finalStatus}; the booking was NOT cancelled.`,
          );
        }
        return;
      }

      if (finalStatus === "CANCELLATION_PENDING") {
        if (Object.keys(query).length > 0) {
          await hotelBookingRepository.findOneAndUpdate(query, {
            status: BookingStatus.CANCELLATION_PENDING,
            tripJackResponse: details,
          });
        }
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      return poll();
    } catch (err: any) {
      console.warn(
        `[TripJack Cancel Poll] Error checking status for ${bookingId}:`,
        err.message,
      );
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      return poll();
    }
  };
  poll().catch((e) =>
    console.error("[TripJack Cancel Poll] Polling error:", e.message),
  );
}

class CancelService {
  private isCancellationAllowed(booking: any): boolean {
    if (!booking || !booking.checkIn) return true;

    const now = new Date();
    const checkInDate = new Date(booking.checkIn);
    let inTime = "";

    try {
      const bAny = booking as any;
      let tjInfo =
        bAny.tripJackResponse?.itemInfos?.HOTEL ||
        bAny.tripJackResponse?.body?.itemInfos?.HOTEL ||
        bAny.tripJackRequest?.itemInfos?.HOTEL;

      if (!tjInfo && typeof bAny.tripJackResponse === "string") {
        try {
          const p = JSON.parse(bAny.tripJackResponse);
          tjInfo = p?.itemInfos?.HOTEL || p?.body?.itemInfos?.HOTEL;
        } catch (e) {}
      }

      let rgIn = bAny.rateGainResponse?.body?.checkInTime;
      if (!rgIn && typeof bAny.rateGainResponse === "string") {
        try {
          const p = JSON.parse(bAny.rateGainResponse);
          rgIn = p?.body?.checkInTime || p?.checkInTime;
        } catch (e) {}
      }

      if (tjInfo?.hInfo) {
        if (tjInfo.hInfo.pt) {
          let pt = tjInfo.hInfo.pt;
          inTime = pt.includes("|") ? pt.split("|")[0] : pt;
        } else if (tjInfo.hInfo.checkInTime) {
          const tjIn = tjInfo.hInfo.checkInTime;
          inTime =
            typeof tjIn === "object" && tjIn !== null
              ? tjIn.beginTime || tjIn.time || ""
              : tjIn || "";
        }
      } else if (rgIn) {
        inTime =
          typeof rgIn === "object" && rgIn !== null
            ? rgIn.beginTime || rgIn.time || ""
            : rgIn || "";
      } else if (bAny.checkInTime) {
        const dbIn = bAny.checkInTime;
        inTime =
          typeof dbIn === "object" && dbIn !== null
            ? dbIn.beginTime
            : dbIn || inTime;
      }
    } catch (e) {}

    let hours = 0;
    let minutes = 0;
    if (inTime && typeof inTime === "string") {
      const clean = inTime.trim().toLowerCase();
      const match = clean.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        if (clean.includes("pm") && hours < 12) hours += 12;
        if (clean.includes("am") && hours === 12) hours = 0;
      }
    }

    checkInDate.setHours(hours, minutes, 0, 0);

    if (now >= checkInDate) {
      console.log(
        `[Cancel Validation] Cancellation rejected. Current time ${now.toISOString()} is past check-in time ${checkInDate.toISOString()}`,
      );
      return false;
    }

    return true;
  }

  async cancel(payload: any) {
    const confirmationNumber = payload.ConfirmationNumber || payload.bookingId;
    const reservationId = payload.ReservationId || payload.bookingId;
    const bookingId = payload.bookingId;

    console.log(
      `🚫 Cancel service called with:`,
      JSON.stringify(payload, null, 2),
    );

    let cancelChargesInfo: any = null;
    try {
      cancelChargesInfo = await this.getCancelCharges(payload);
    } catch (e: any) {
      console.warn(
        `[Cancel Service] Could not pre-calculate cancel charges: ${e.message}`,
      );
    }

    // ─── Step 0: Initial Validation & DB Lookup ───
    const initialTargetId = confirmationNumber || reservationId || bookingId;
    const query: any = {};
    if (initialTargetId) {
      const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(initialTargetId));
      if (isObjectId) {
        query._id = initialTargetId;
      } else {
        query.$or = [
          { confirmationNumber: initialTargetId },
          { reservationId: initialTargetId },
        ];
      }
    }

    let booking = null;
    if (Object.keys(query).length > 0) {
      booking = await hotelBookingRepository.findOne(query, true);
    }

    if (booking && !this.isCancellationAllowed(booking)) {
      return {
        status: false,
        statusCode: 400,
        description:
          "Cancellation is not permitted after the hotel's check-in time has passed.",
        isFullyCancelled: false,
        body: {
          status: "FAILED",
          message: "Cancellation blocked due to check-in time passing.",
        },
      };
    }

    // ─── Step 1: Check if this is a TripJack booking ───
    try {
      const isTripJack =
        payload.type === "HOTEL" ||
        confirmationNumber?.startsWith("TG") ||
        confirmationNumber?.startsWith("TJ");

      let isDbTripJack = false;
      let actualTargetId = confirmationNumber || bookingId;

      if (booking && booking.provider === BookingProvider.TRIPJACK) {
        isDbTripJack = true;
        if (booking.confirmationNumber)
          actualTargetId = booking.confirmationNumber;
      }

      if (isTripJack || isDbTripJack) {
        console.log(
          `[TripJack] Cancelling TripJack booking: ${actualTargetId}`,
        );
        const tjResponse = await tripJackProvider.cancel(actualTargetId);
        const targetId = actualTargetId;

        const isSuccessAck =
          tjResponse?.body?.status?.success === true ||
          tjResponse?.status?.success === true ||
          tjResponse?.status === true;

        if (isSuccessAck) {
          // An ack is not a cancellation. Record the intent and the charge
          // breakdown now (the penalty depends on *when* we asked), then let the
          // poll flip it to CANCELLED once TripJack actually confirms — which is
          // also when the traveller's money goes back.
          if (Object.keys(query).length > 0) {
            await hotelBookingRepository.findOneAndUpdate(query, {
              status: BookingStatus.CANCELLATION_PENDING,
              tripJackResponse: tjResponse?.body,
              cancelCharge:
                cancelChargesInfo?.applicableCharge !== undefined
                  ? cancelChargesInfo.applicableCharge
                  : undefined,
              cancelChargesInfo: cancelChargesInfo,
              cancellationDetails: cancelChargesInfo?.cancellation,
            });
            console.log(
              `✅ [TripJack] Cancellation acknowledged; booking marked CANCELLATION_PENDING: ${targetId}`,
            );
          }

          // Trigger asynchronous background polling to verify terminal status.
          pollTripJackCancellationStatus(targetId, query, cancelChargesInfo);
        }

        return {
          status: isSuccessAck,
          statusCode: 200,
          description: isSuccessAck
            ? "Cancellation requested. Your refund will be processed once the hotel confirms."
            : "Cancellation failed",
          // The supplier has only acknowledged the request; the poll confirms it.
          isFullyCancelled: false,
          tjStatus: isSuccessAck ? "CANCELLATION_PENDING" : "FAILED",
          totalAmount: cancelChargesInfo?.totalAmount,
          applicableCharge: cancelChargesInfo?.applicableCharge,
          refundAmount: cancelChargesInfo?.refundAmount,
          cancellation: cancelChargesInfo?.cancellation,
          deadlineDateTime: cancelChargesInfo?.deadlineDateTime,
          body: tjResponse?.body || tjResponse,
        };
      }
    } catch (tjCancelErr: any) {
      console.error("[TripJack] Cancel routing error:", tjCancelErr.message);
      throw tjCancelErr;
    }

    // ─── Step 2: Look up booking from DB to get the full original request data ───
    let enrichedPayload = { ...payload };
    let dbLookupSucceeded = false;

    try {
      if (Object.keys(query).length > 0) {
        if (booking) {
          console.log(`📦 Found booking in DB: ${booking.confirmationNumber}`);
          console.log(
            `📦 rateGainRequest exists: ${!!booking.rateGainRequest}`,
          );
          console.log(
            `📦 rateGainRequest.BookReservation exists: ${!!booking.rateGainRequest?.BookReservation}`,
          );

          // Extract the original BookReservation from the stored rateGainRequest
          const originalRequest =
            booking.rateGainRequest?.BookReservation || {};
          const rateGainResp = booking.rateGainResponse || {};

          const brandCode =
            originalRequest.BrandCode ||
            booking.brandCode ||
            rateGainResp.body?.brandCode ||
            rateGainResp.body?.booking?.hotel?.brandCode ||
            rateGainResp.body?.BrandCode ||
            payload.BrandCode ||
            booking.propertyCode ||
            originalRequest.PropertyCode ||
            payload.PropertyCode ||
            "N/A";

          console.log(`📦 Extracted BrandCode: "${brandCode}"`);

          // Build a complete cancellation payload using stored data
          enrichedPayload = {
            ConfirmationNumber: booking.confirmationNumber,
            ReservationId: booking.reservationId,
            PropertyId: booking.propertyId,
            hotelId: booking.propertyId, // also pass as hotelId so provider can find it
            PropertyCode:
              booking.propertyCode ||
              originalRequest.PropertyCode ||
              payload.PropertyCode,
            BrandCode: brandCode,
            CurrencyCode:
              originalRequest.CurrencyCode || booking.currencyCode || "USD",
            CountryCode: originalRequest.CountryCode || "IN",
            Session: originalRequest.Session || `klar-session-${Date.now()}`,
            EchoToken:
              payload.EchoToken ||
              originalRequest.EchoToken ||
              `echo-${Date.now()}`,
            TimeStamp: payload.TimeStamp || new Date().toISOString(),
            DemandCancelId:
              payload.DemandCancelId || `demand-cancel-${Date.now()}`,
          };

          dbLookupSucceeded = true;
          console.log(
            `✅ Enriched cancel payload:`,
            JSON.stringify(enrichedPayload, null, 2),
          );
        } else {
          console.warn(
            `⚠️ Booking NOT found in DB (conf: ${confirmationNumber}, resId: ${reservationId}). Using raw payload.`,
          );
        }
      } else {
        console.warn(
          `⚠️ No ConfirmationNumber or ReservationId in payload. Cannot look up booking.`,
        );
      }
    } catch (dbError: any) {
      console.error(
        "❌ DB lookup failed, falling back to raw payload:",
        dbError.message,
      );
    }

    if (!dbLookupSucceeded) {
      console.warn(
        `⚠️ Using raw/fallback payload for cancel:`,
        JSON.stringify(enrichedPayload, null, 2),
      );
      if (!enrichedPayload.BrandCode) {
        enrichedPayload.BrandCode = enrichedPayload.PropertyCode || "N/A";
      }
    }

    // ─── Step 2: Call RateGain CancelReservation ───
    let rateGainResponse;
    try {
      rateGainResponse = await rateGainProvider.cancel(enrichedPayload);
    } catch (error: any) {
      const errorDataStr = JSON.stringify(error.response?.data || {});
      const errorDesc =
        error.response?.data?.description ||
        error.response?.data?.Description ||
        error.message ||
        "";

      // If RateGain throws "ConfirmationNumber(...) Number Invalid", it means the booking is already cancelled on their side.
      if (
        (error.response?.status === 400 || error.response?.status === 500) &&
        (errorDesc.includes("Number Invalid") ||
          errorDataStr.includes("Number Invalid"))
      ) {
        console.log(
          `⚠️ RateGain says Number Invalid. Assuming booking is already cancelled on their end. Gracefully syncing local DB.`,
        );
        rateGainResponse = {
          status: true,
          statusCode: 200,
          body: {
            cancellationNumber: "PREV-CANCELLED",
            confirmationNumber:
              confirmationNumber || enrichedPayload.ConfirmationNumber,
            status: "CANCELLED",
          },
        };
      } else {
        throw error; // Rethrow actual failures
      }
    }

    // ─── Step 3: Update local DB status if cancellation succeeded ───
    try {
      // Per RateGain spec §8, a successful cancel returns outer status:true AND
      // body.status "CANCELLED" with a cancellationNumber. Require the inner
      // confirmation too — don't mark CANCELLED off a bare success envelope.
      const rgBody = rateGainResponse?.body;
      const rgCancelNumber = rgBody?.cancellationNumber;
      const rgCancelled =
        /^cancelled$/i.test((rgBody?.status || "").toString().trim()) ||
        !!rgCancelNumber;
      if (
        rateGainResponse &&
        (rateGainResponse.status === true ||
          rateGainResponse.status === "success") &&
        rgCancelled
      ) {
        const targetId = confirmationNumber || reservationId || bookingId;
        if (targetId) {
          const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(targetId));
          const query: any = isObjectId
            ? { _id: targetId }
            : {
                $or: [
                  { confirmationNumber: targetId },
                  { reservationId: targetId },
                ],
              };

          // RateGain confirms the cancellation synchronously, so record the
          // breakdown and settle the traveller's refund in the same pass.
          // refundCancelledBooking is what finally moves it to CANCELLED.
          const updated = await hotelBookingRepository.findOneAndUpdate(
            query,
            {
              status: BookingStatus.CANCELLATION_PENDING,
              cancelCharge:
                cancelChargesInfo?.applicableCharge !== undefined
                  ? cancelChargesInfo.applicableCharge
                  : undefined,
              cancelChargesInfo: cancelChargesInfo,
              cancellationDetails: {
                ...(cancelChargesInfo?.cancellation || {}),
                ...(rgCancelNumber
                  ? { cancellationNumber: rgCancelNumber }
                  : {}),
              },
            },
            { new: true },
          );

          if (updated) {
            if (process.env.ENABLE_AUTO_REFUNDS === "false") {
              console.log(
                `✅ RateGain confirmed cancellation for ${updated.confirmationNumber}; auto-refund disabled, marking CANCELLED.`,
              );
              const finalUpdated =
                await hotelBookingRepository.findOneAndUpdate(
                  { _id: updated._id },
                  { status: BookingStatus.CANCELLED },
                  { new: true },
                );
              if (finalUpdated) {
                notificationService.sendBookingStatusEmail(
                  finalUpdated,
                  BookingStatus.CANCELLED,
                );
              }
            } else {
              console.log(
                `✅ RateGain confirmed cancellation for ${updated.confirmationNumber}; settling refund.`,
              );
              await refundService.settleCancellation(
                updated,
                cancelChargesInfo,
              );
            }
          }
        }
      }
    } catch (dbError: any) {
      console.error(
        "⚠️ local DB update failed (RateGain cancel was successful):",
        dbError.message,
      );
    }

    if (rateGainResponse && typeof rateGainResponse === "object") {
      rateGainResponse.totalAmount = cancelChargesInfo?.totalAmount;
      rateGainResponse.applicableCharge = cancelChargesInfo?.applicableCharge;
      rateGainResponse.refundAmount = cancelChargesInfo?.refundAmount;
      rateGainResponse.cancellation = cancelChargesInfo?.cancellation;
      rateGainResponse.deadlineDateTime = cancelChargesInfo?.deadlineDateTime;
    }

    return rateGainResponse;
  }

  async getCancelCharges(payload: any) {
    const confirmationNumber = payload.ConfirmationNumber || payload.bookingId;
    const reservationId = payload.ReservationId || payload.bookingId;
    const bookingId = payload.bookingId;

    const targetId = confirmationNumber || reservationId || bookingId;
    if (!targetId) {
      throw new Error(
        "Missing booking identifier (bookingId or confirmationNumber)",
      );
    }

    const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(targetId));
    const query: any = isObjectId
      ? { _id: targetId }
      : {
          $or: [{ confirmationNumber: targetId }, { reservationId: targetId }],
        };

    const booking = await hotelBookingRepository.findOne(query, true);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Logic for TripJack
    const isTripJack =
      booking.provider === BookingProvider.TRIPJACK ||
      payload.type === "HOTEL" ||
      confirmationNumber?.startsWith("TJ") ||
      confirmationNumber?.startsWith("TG");

    if (isTripJack) {
      // Try fetching latest details from TripJack to get the most accurate policy
      let tjDetails = null;
      try {
        const tjTargetId =
          booking.confirmationNumber || confirmationNumber || bookingId;
        tjDetails = await tripJackProvider.getBookingDetails(tjTargetId);
      } catch (err) {
        console.warn(
          "[Cancel Service] Could not fetch latest booking details from TJ for cancel charges.",
          err,
        );
      }

      const tjResp: any = tjDetails || booking.tripJackResponse || {};
      const policyData =
        tjResp?.order?.cancellationPolicy ||
        tjResp?.itemInfos?.[0]?.cancellationPolicy ||
        tjResp?.cancellationPolicy ||
        tjResp?.itemInfos?.HOTEL?.ops?.[0]?.cnp ||
        tjResp?.order?.itemInfos?.HOTEL?.ops?.[0]?.cnp ||
        tjResp?.itemInfos?.HOTEL?.hInfo?.ops?.[0]?.cnp ||
        tjResp?.order?.itemInfos?.HOTEL?.hInfo?.ops?.[0]?.cnp ||
        tjResp?.order?.itemInfos?.[0]?.item?.cnp ||
        tjResp?.itemInfos?.[0]?.item?.cnp;

      if (!policyData) {
        return {
          status: true,
          statusCode: 200,
          description:
            "Cancellation policy not found. Cannot calculate exact charges.",
          applicableCharge: null,
          policy: null,
        };
      }

      const now = new Date();
      let applicableCharge = 0;
      let chargeCurrency = "INR";

      if (
        policyData.pd &&
        Array.isArray(policyData.pd) &&
        policyData.pd.length > 0
      ) {
        // TripJack v3 cnp.pd format
        const policies = [...policyData.pd].sort(
          (a, b) => new Date(a.fdt).getTime() - new Date(b.fdt).getTime(),
        );

        let foundCharge = false;
        for (const p of policies) {
          if (now >= new Date(p.fdt) && now <= new Date(p.tdt)) {
            applicableCharge = p.am;
            foundCharge = true;
            break;
          }
        }

        if (!foundCharge) {
          // If current time is past all ranges, default to the maximum penalty (usually the last entry)
          applicableCharge = policies[policies.length - 1].am || 0;
        }
      } else if (
        policyData.cancelPolicyInfos &&
        Array.isArray(policyData.cancelPolicyInfos) &&
        policyData.cancelPolicyInfos.length > 0
      ) {
        // Sort by time ascending
        const policies = [...policyData.cancelPolicyInfos].sort(
          (a, b) =>
            new Date(a.cancelTime).getTime() - new Date(b.cancelTime).getTime(),
        );

        let foundCharge = false;
        for (const p of policies) {
          if (now < new Date(p.cancelTime)) {
            applicableCharge = p.amount;
            if (p.currency) chargeCurrency = p.currency;
            foundCharge = true;
            break;
          }
        }

        // If now is past all cancelTime boundaries
        if (!foundCharge) {
          applicableCharge =
            policyData.noShowPolicy?.amount ||
            policies[policies.length - 1].amount ||
            0;
        }
      } else if (policyData.policies && Array.isArray(policyData.policies)) {
        // Alternative TJ policy format
        const policies = [...policyData.policies].sort(
          (a, b) =>
            new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime(),
        );
        let foundCharge = false;
        for (const p of policies) {
          if (now < new Date(p.fromDate)) {
            applicableCharge = p.cancellationCharge || p.amount;
            if (p.currency) chargeCurrency = p.currency;
            foundCharge = true;
            break;
          }
        }
        if (!foundCharge) {
          applicableCharge =
            policies[policies.length - 1].cancellationCharge ||
            policies[policies.length - 1].amount ||
            0;
        }
      } else if (policyData.amount !== undefined) {
        // Flat charge
        applicableCharge = policyData.amount;
      }

      const totalAmount = booking.totalAmount || 0;
      const refundAmount = Math.max(0, totalAmount - applicableCharge);

      let unifiedPenalties: any[] = [];
      if (policyData.pd && Array.isArray(policyData.pd)) {
        unifiedPenalties = policyData.pd.map((p: any) => ({
          from: p.fdt,
          to: p.tdt,
          amount: p.am,
        }));
      } else if (
        policyData.cancelPolicyInfos &&
        Array.isArray(policyData.cancelPolicyInfos)
      ) {
        unifiedPenalties = policyData.cancelPolicyInfos.map(
          (p: any, index: number, arr: any[]) => ({
            from: p.cancelTime,
            to: arr[index + 1]
              ? arr[index + 1].cancelTime
              : booking.checkIn
                ? new Date(booking.checkIn).toISOString()
                : null,
            amount: p.amount,
          }),
        );
      } else if (policyData.policies && Array.isArray(policyData.policies)) {
        unifiedPenalties = policyData.policies.map(
          (p: any, index: number, arr: any[]) => ({
            from: p.fromDate,
            to:
              p.toDate ||
              (arr[index + 1]
                ? arr[index + 1].fromDate
                : booking.checkIn
                  ? new Date(booking.checkIn).toISOString()
                  : null),
            amount: p.cancellationCharge || p.amount,
          }),
        );
      }

      const isRefundable =
        policyData.ifra !== undefined
          ? policyData.ifra
          : policyData.inra === false
            ? true
            : true;
      const deadlineDateTime =
        tjResp?.order?.itemInfos?.[0]?.item?.ddt ||
        tjResp?.itemInfos?.[0]?.item?.ddt ||
        tjResp?.order?.lastCancellationDate ||
        policyData.deadline ||
        null;

      return {
        status: true,
        statusCode: 200,
        description: "Calculated cancellation charges from booking policy",
        totalAmount,
        applicableCharge,
        refundAmount,
        currency: chargeCurrency,
        cancellation: {
          isRefundable,
          penalties: unifiedPenalties,
        },
        deadlineDateTime,
        policy: policyData,
        calculationTime: now.toISOString(),
      };
    }

    // ─── RateGain cancellation-charge preview (best-effort) ───
    // RG has no single canonical policy shape, so we read whatever policy the
    // booking captured and compute the applicable penalty by today's date. When
    // the data is missing/ambiguous we return applicableCharge: null, which the
    // refund resolver treats as "unknown" and safely parks for manual review —
    // it never guesses a refund number.
    const totalAmount = booking.totalAmount || 0;
    const currency = (booking.currencyCode || "INR").toUpperCase();

    // Hard non-refundable signal in the stored rate → full penalty.
    const rateComments = (booking.rateComments || "").toString();
    if (/NON[-\s]?REFUNDABLE/i.test(rateComments)) {
      return {
        status: true,
        statusCode: 200,
        description: "Non-refundable rate — full cancellation charge applies.",
        totalAmount,
        applicableCharge: totalAmount,
        refundAmount: 0,
        currency,
        cancellation: { isRefundable: false, penalties: [] },
      };
    }

    // Gather policy entries from wherever the booking stored them.
    const rg: any = booking.rateGainResponse || {};
    const rawPolicies: any[] =
      booking.cancellationDetails?.penalties ||
      rg?.body?.booking?.hotel?.rooms?.[0]?.rates?.[0]?.cancellationPolicies ||
      rg?.body?.booking?.cancellationPolicies ||
      booking.rateGainRequest?.BookReservation?.RoomSelection?.[0]
        ?.cancellationPolicies ||
      [];

    if (!Array.isArray(rawPolicies) || rawPolicies.length === 0) {
      return {
        status: true,
        statusCode: 200,
        description:
          "Cancellation policy not found. Charges will be confirmed manually.",
        totalAmount,
        applicableCharge: null,
        refundAmount: null,
        currency,
        policy: null,
      };
    }

    const now = new Date();
    const norm = rawPolicies
      .map((p: any) => ({
        from: p.from || p.fromDate || p.FromDate || p.toDate || null,
        to: p.to || p.toDate || p.ToDate || null,
        amount: Number(p.amount ?? p.Amount ?? p.charge ?? p.penalty ?? 0) || 0,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(a.from || 0).getTime() - new Date(b.from || 0).getTime(),
      );

    let applicableCharge = 0;
    let matched = false;
    for (const p of norm) {
      const from = p.from ? new Date(p.from) : null;
      const to = p.to ? new Date(p.to) : null;
      if (from && to) {
        if (now >= from && now <= to) {
          applicableCharge = p.amount;
          matched = true;
          break;
        }
      } else if (from && now >= from) {
        applicableCharge = p.amount;
        matched = true;
      }
    }
    if (!matched && norm.length > 0) {
      // Past all windows → the last (highest) penalty is the conservative choice.
      applicableCharge = norm[norm.length - 1].amount;
    }

    const refundAmount = Math.max(0, totalAmount - applicableCharge);
    return {
      status: true,
      statusCode: 200,
      description:
        "Calculated cancellation charges from booking policy (RateGain).",
      totalAmount,
      applicableCharge,
      refundAmount,
      currency,
      cancellation: {
        isRefundable: applicableCharge < totalAmount,
        penalties: norm,
      },
      calculationTime: now.toISOString(),
    };
  }
}

export const cancelService = new CancelService();
