import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { commitService } from "../services/commit.service";
import { compileTravellerPayload } from "../utils/bookingTransformer";
import { StructuredError } from "../services/ValidationEngine";

export const commitController = async (req: any, res: Response) => {
  const requestId = uuidv4();
  try {
    const agentId = req.user?.userId || req.user?.id || req.user?._id || null;
    const agentName = req.user?.email || null; // Fallback to email if name isn't in token
    const token = req.headers.authorization?.split(" ")[1] || "";
    let clientType =
      req.headers["x-client-type"] ||
      req.body.clientType ||
      req.user?.clientType ||
      "B2C";
    if (!agentId && clientType === "B2C") {
      clientType = "GUEST";
    }

    let finalPayload = req.body;

    // INTERCEPT UNIFIED PAYLOAD
    if (req.body.bookingFormData && req.body.providerContext) {
      const compiledProviderPayload = compileTravellerPayload(
        req.body.bookingFormData,
        req.body.providerContext,
      );
      finalPayload = {
        ...compiledProviderPayload,
        bookingId:
          req.body.providerContext.bookingId ||
          compiledProviderPayload.bookingId ||
          req.body.bookingFormData.precheckBookingId,
        propertyId:
          req.body.providerContext.hotelId || req.body.bookingFormData.hotelId,
        netPrice: Number(
          req.body.bookingFormData.totalNet ||
            req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]
              ?.tp ||
            req.body.bookingFormData.totalPrice ||
            0,
        ),
        sellingRate: Number(req.body.bookingFormData.totalPrice || 0),
        totalPrice: Number(
          req.body.bookingFormData.totalPrice ||
            req.body.bookingFormData.totalNet ||
            0,
        ),

        // TripJack dynamic check parameters
        optionId:
          req.body.bookingPayload?.optionId ||
          req.body.bookingFormData.optionId ||
          req.body.bookingFormData.precheckResponse?.body?.option?.optionId ||
          req.body.bookingFormData.precheckResponse?.body?.option?.id ||
          req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]?.id,
        reviewHash:
          req.body.bookingPayload?.reviewHash ||
          req.body.bookingFormData.reviewHash ||
          req.body.bookingFormData.precheckResponse?.body?.reviewHash ||
          req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]
            ?.reviewHash,
        correlationId:
          req.body.bookingPayload?.correlationId ||
          req.body.bookingFormData.correlationId ||
          req.body.bookingFormData.precheckResponse?.body?.correlationId,
        hid:
          req.body.bookingPayload?.hid ||
          req.body.bookingFormData.hid ||
          req.body.bookingFormData.precheckResponse?.body?.tjHotelId ||
          req.body.bookingFormData.precheckResponse?.body?.hid ||
          req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]?.hid,

        // Additional meta fields nested in bookingFormData
        isHold:
          req.body.bookingFormData.isHoldBooking === true ||
          req.body.bookingFormData.isHold === true,
        hotelName: req.body.bookingFormData.hotelName,
        hotelImage: req.body.bookingFormData.hotelImage,
        hotelAddress: req.body.bookingFormData.hotelAddress,
        city: req.body.bookingFormData.city,
        starRating: req.body.bookingFormData.starRating,
        checkIn: req.body.bookingFormData.checkIn,
        checkOut: req.body.bookingFormData.checkOut,
        additionalMarkup: req.body.bookingFormData.additionalMarkup,
        couponCode: req.body.bookingFormData.couponCode,
        roomName: req.body.bookingFormData.roomName,
        razorpayOrderId: req.body.razorpayOrderId,
        razorpayPaymentId: req.body.razorpayPaymentId,
        bookingPayload: {
          ...(req.body.bookingPayload || {}),
          ...(compiledProviderPayload.gstInfo && {
            gstInfo: compiledProviderPayload.gstInfo,
          }),
        },
      };
      console.log(
        `[FORENSIC] Compiled Unified Payload for property: ${finalPayload.propertyId}, Price: ${finalPayload.totalPrice}`,
      );
    }

    // Idempotency key (header preferred, body fallback) so a retried commit
    // returns the original booking instead of creating a duplicate.
    let idempKey =
      (req.headers["idempotency-key"] as string) ||
      req.body.idempotencyKey ||
      finalPayload.idempotencyKey;
    if (idempKey) {
      if (!idempKey.endsWith(`_${clientType}`)) {
        idempKey = `${idempKey}_${clientType}`;
      }
      finalPayload.idempotencyKey = idempKey;
    }

    console.log(
      `[FORENSIC] Commit Booking [${requestId}]: agentId=${agentId}, agentName=${agentName}, clientType=${clientType}`,
    );
    const userInfo = {
      id: req.user?.userId || req.user?.id || req.user?._id || "",
      email: req.user?.email || "",
      role: req.user?.role || req.user?.roles?.[0] || "",
      clientType: clientType,
    };
    const data = await commitService.commit(
      finalPayload,
      agentId,
      agentName,
      token,
      clientType,
      requestId,
      userInfo,
    );
    res.json({
      status: true,
      statusCode: 200,
      description: "Booking committed successfully",
      body: data,
    });
  } catch (error: any) {
    console.error(
      `Commit Controller Error [${requestId}]:`,
      error.response?.data || error.message,
    );

    if (error instanceof StructuredError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }

    // Raw upstream/supplier errors are logged above but never returned to the
    // client (avoids leaking supplier identity/messages). User-safe failures go
    // through StructuredError above; everything else is a generic message.
    res.status(error.response?.status || error.status || 500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          "We could not complete your booking. If any amount was debited it will be refunded automatically. Please try again or contact support.",
        details: null,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
};
