import { Request, Response } from "express";
import { commitService } from "../services/commit.service";
import { compileTravellerPayload } from "../utils/bookingTransformer";

export const commitController = async (req: any, res: Response) => {
    try {
        const agentId = req.user?.userId || req.user?.id || req.user?._id || null;
        const agentName = req.user?.email || null; // Fallback to email if name isn't in token
        const token = req.headers.authorization?.split(" ")[1] || "";
        const clientType = req.user?.clientType || "B2C";

        let finalPayload = req.body;
        
        // INTERCEPT UNIFIED PAYLOAD
        if (req.body.bookingFormData && req.body.providerContext) {
            const compiledProviderPayload = compileTravellerPayload(req.body.bookingFormData, req.body.providerContext);
            finalPayload = {
                ...compiledProviderPayload,
                bookingId: req.body.providerContext.bookingId || compiledProviderPayload.bookingId || req.body.bookingFormData.precheckBookingId,
                propertyId: req.body.providerContext.hotelId || req.body.bookingFormData.hotelId,
                totalPrice: Number(req.body.bookingFormData.totalNet || req.body.bookingFormData.totalPrice || req.body.bookingFormData.precheckResponse?.body?.option?.pricing?.totalPrice || req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]?.tp || 0),
                
                // TripJack dynamic check parameters
                optionId: req.body.bookingPayload?.optionId || req.body.bookingFormData.optionId || req.body.bookingFormData.precheckResponse?.body?.option?.optionId || req.body.bookingFormData.precheckResponse?.body?.option?.id || req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]?.id,
                reviewHash: req.body.bookingPayload?.reviewHash || req.body.bookingFormData.reviewHash || req.body.bookingFormData.precheckResponse?.body?.reviewHash || req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]?.reviewHash,
                correlationId: req.body.bookingPayload?.correlationId || req.body.bookingFormData.correlationId || req.body.bookingFormData.precheckResponse?.body?.correlationId,
                hid: req.body.bookingPayload?.hid || req.body.bookingFormData.hid || req.body.bookingFormData.precheckResponse?.body?.tjHotelId || req.body.bookingFormData.precheckResponse?.body?.hid || req.body.bookingFormData.precheckResponse?.body?.hInfo?.ops?.[0]?.hid,
                
                // Additional meta fields nested in bookingFormData
                isHold: req.body.bookingFormData.isHoldBooking === true || req.body.bookingFormData.isHold === true,
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
                bookingPayload: {
                    ...(req.body.bookingPayload || {}),
                    ...(compiledProviderPayload.gstInfo && { gstInfo: compiledProviderPayload.gstInfo })
                }
            };
            console.log(`[FORENSIC] Compiled Unified Payload for property: ${finalPayload.propertyId}, Price: ${finalPayload.totalPrice}`);
        }

        console.log(`[FORENSIC] Commit Booking: agentId=${agentId}, agentName=${agentName}, clientType=${clientType}`);
        const data = await commitService.commit(finalPayload, agentId, agentName, token, clientType);
        res.json({
            status: true,
            statusCode: 200,
            description: "Booking committed successfully",
            body: data
        });
    } catch (error: any) {
        console.error("Commit Controller Error:", error.response?.data || error.message);
        
        const errorData = error.response?.data || error.data;
        const errorMessage = errorData?.errors?.[0]?.message || 
                             errorData?.error?.message || 
                             errorData?.description || 
                             error.message || 
                             "Failed to commit booking";

        res.status(error.response?.status || error.status || 500).json({
            status: false,
            statusCode: error.response?.status || error.status || 500,
            description: errorMessage,
            body: errorData || null
        });
    }
};
