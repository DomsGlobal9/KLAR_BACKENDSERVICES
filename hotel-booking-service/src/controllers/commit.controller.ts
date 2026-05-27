import { Request, Response } from "express";
import { commitService } from "../services/commit.service";
import { compileTravellerPayload } from "../utils/bookingTransformer";

export const commitController = async (req: any, res: Response) => {
    try {
        const agentId = req.user?.userId || req.user?.id || req.user?._id || null;
        const agentName = req.user?.email || null; // Fallback to email if name isn't in token
        const token = req.headers.authorization?.split(" ")[1] || "";

        let finalPayload = req.body;
        
        // INTERCEPT UNIFIED PAYLOAD
        if (req.body.bookingFormData && req.body.providerContext) {
            const compiledProviderPayload = compileTravellerPayload(req.body.bookingFormData, req.body.providerContext);
            finalPayload = {
                ...compiledProviderPayload,
                ...req.body.meta, // hotelName, hotelImage, additionalMarkup, etc.
                bookingId: req.body.providerContext.bookingId || compiledProviderPayload.bookingId,
                propertyId: req.body.providerContext.hotelId,
                totalPrice: req.body.providerContext.totalAggregatePrice,
            };
            console.log(`[FORENSIC] Compiled Unified Payload for property: ${finalPayload.propertyId}`);
        }

        console.log(`[FORENSIC] Commit Booking: agentId=${agentId}, agentName=${agentName}`);
        const data = await commitService.commit(finalPayload, agentId, agentName, token);
        res.json(data);
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
