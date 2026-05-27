import { rateGainProvider } from "../providers/rategain.provider";
import { tripJackProvider } from "../providers/tripjack.provider";
import { BookingModel, BookingStatus, BookingProvider } from "../models/Booking.model";

class CancelService {
    async cancel(payload: any) {
        const confirmationNumber = payload.ConfirmationNumber || payload.bookingId;
        const reservationId = payload.ReservationId || payload.bookingId;
        const bookingId = payload.bookingId;

        console.log(`🚫 Cancel service called with:`, JSON.stringify(payload, null, 2));

        let cancelChargesInfo: any = null;
        try {
            cancelChargesInfo = await this.getCancelCharges(payload);
        } catch (e: any) {
            console.warn(`[Cancel Service] Could not pre-calculate cancel charges: ${e.message}`);
        }

        // ─── Step 0: Check if this is a TripJack booking ───
        try {
            const initialTargetId = confirmationNumber || reservationId || bookingId;
            const query: any = {};
            if (initialTargetId) {
                const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(initialTargetId));
                if (isObjectId) {
                    query._id = initialTargetId;
                } else {
                    query.$or = [
                        { confirmationNumber: initialTargetId },
                        { reservationId: initialTargetId }
                    ];
                }
            }

            const isTripJack = payload.type === "HOTEL" || 
                               confirmationNumber?.startsWith("TG") || 
                               confirmationNumber?.startsWith("TJ");

            let isDbTripJack = false;
            let actualTargetId = confirmationNumber || bookingId;

            if (Object.keys(query).length > 0) {
                const booking = await BookingModel.findOne(query).lean();
                if (booking && booking.provider === BookingProvider.TRIPJACK) {
                    isDbTripJack = true;
                    if (booking.confirmationNumber) actualTargetId = booking.confirmationNumber;
                }
            }

            if (isTripJack || isDbTripJack) {
                console.log(`[TripJack] Cancelling TripJack booking: ${actualTargetId}`);
                const tjResponse = await tripJackProvider.cancel(actualTargetId);
                const targetId = actualTargetId; // For polling details below

                // Poll booking details up to 3 times (6s) to verify cancellation
                let isFullyCancelled = false;
                let finalStatus = "PENDING";
                let details = null;

                for (let i = 0; i < 3; i++) {
                    try {
                        details = await tripJackProvider.getBookingDetails(targetId);
                        finalStatus = details?.order?.status || "PENDING";
                        const apiSuccess = details?.status?.success === true;
                        
                        // Terminal statuses for cancellation:
                        const isTerminal = finalStatus === "CANCELLED" || finalStatus === "FAILED" || finalStatus === "ABORTED";
                        const isSystemPending = details?.isSystemPending === true;
                        
                        console.log(`[TripJack Cancel] Poll ${i+1}: apiSuccess=${apiSuccess}, isSystemPending=${isSystemPending}, status=${finalStatus}`);

                        // Wait if system is still processing and we haven't reached a terminal status
                        if (apiSuccess && isTerminal) {
                            isFullyCancelled = true;
                            break;
                        }
                    } catch (statusErr: any) {
                        console.warn("[TripJack] Could not verify cancelled status:", statusErr.message);
                    }
                    if (!isFullyCancelled) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }

                // If cancel API itself returns success true directly, and we couldn't verify, we might still treat it as cancelled
                const isSuccessAck = tjResponse?.body?.status?.success === true || tjResponse?.status?.success === true || tjResponse?.status === true;
                if (!isFullyCancelled && isSuccessAck) {
                    if (finalStatus === "CANCELLATION_PENDING") {
                        console.log(`[TripJack Cancel] Polling timeout and status is CANCELLATION_PENDING. Keeping status as PENDING for offline processing.`);
                    } else {
                        console.log(`[TripJack Cancel] Warning: Polling timeout but Cancel API returned success. Proceeding with cancel.`);
                        isFullyCancelled = true;
                    }
                }

                const dbStatusToSet = isFullyCancelled ? BookingStatus.CANCELLED : (finalStatus === "CANCELLATION_PENDING" ? BookingStatus.PENDING : BookingStatus.PENDING);

                if (Object.keys(query).length > 0) {
                    await BookingModel.findOneAndUpdate(query, { 
                        status: dbStatusToSet,
                        tripJackResponse: details || tjResponse?.body,
                        cancelCharge: cancelChargesInfo?.applicableCharge !== undefined ? cancelChargesInfo.applicableCharge : undefined,
                        cancelChargesInfo: cancelChargesInfo,
                        cancellationDetails: cancelChargesInfo?.cancellation
                    });
                    console.log(`✅ [TripJack] Booking status updated in DB to ${dbStatusToSet}: ${targetId}`);
                }

                return {
                    status: true,
                    statusCode: 200,
                    description: isFullyCancelled ? "TripJack Cancel Success" : "Cancellation initiated. Pending confirmation from TripJack supplier.",
                    isFullyCancelled,
                    tjStatus: finalStatus,
                    totalAmount: cancelChargesInfo?.totalAmount,
                    applicableCharge: cancelChargesInfo?.applicableCharge,
                    refundAmount: cancelChargesInfo?.refundAmount,
                    cancellation: cancelChargesInfo?.cancellation,
                    deadlineDateTime: cancelChargesInfo?.deadlineDateTime,
                    body: tjResponse?.body || tjResponse
                };
            }
        } catch (tjCancelErr: any) {
            console.error("[TripJack] Cancel routing error:", tjCancelErr.message);
            throw tjCancelErr;
        }

        // ─── Step 1: Look up booking from DB to get the full original request data ───
        let enrichedPayload = { ...payload };
        let dbLookupSucceeded = false;

        try {
            const targetId = confirmationNumber || reservationId || bookingId;
            const query: any = {};
            if (targetId) {
                const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(targetId));
                if (isObjectId) {
                    query._id = targetId;
                } else {
                    query.$or = [
                        { confirmationNumber: targetId },
                        { reservationId: targetId }
                    ];
                }
            }

            if (Object.keys(query).length > 0) {
                console.log(`🔍 Looking up booking in DB with query:`, JSON.stringify(query));
                const booking = await BookingModel.findOne(query).lean();

                if (booking) {
                    console.log(`📦 Found booking in DB: ${booking.confirmationNumber}`);
                    console.log(`📦 rateGainRequest exists: ${!!booking.rateGainRequest}`);
                    console.log(`📦 rateGainRequest.BookReservation exists: ${!!booking.rateGainRequest?.BookReservation}`);

                    // Extract the original BookReservation from the stored rateGainRequest
                    const originalRequest = booking.rateGainRequest?.BookReservation || {};
                    const rateGainResp = booking.rateGainResponse || {};

                    const brandCode = originalRequest.BrandCode
                        || rateGainResp.body?.brandCode
                        || rateGainResp.body?.BrandCode
                        || payload.BrandCode
                        || booking.propertyCode
                        || originalRequest.PropertyCode
                        || payload.PropertyCode
                        || "N/A";

                    console.log(`📦 Extracted BrandCode: "${brandCode}"`);

                    // Build a complete cancellation payload using stored data
                    enrichedPayload = {
                        ConfirmationNumber: booking.confirmationNumber,
                        ReservationId: booking.reservationId,
                        PropertyId: booking.propertyId,
                        PropertyCode: booking.propertyCode || originalRequest.PropertyCode || payload.PropertyCode,
                        BrandCode: brandCode,
                        CurrencyCode: originalRequest.CurrencyCode || booking.currencyCode || "USD",
                        CountryCode: originalRequest.CountryCode || "IN",
                        Session: originalRequest.Session || `klar-session-${Date.now()}`,
                        EchoToken: payload.EchoToken || originalRequest.EchoToken || `echo-${Date.now()}`,
                        TimeStamp: payload.TimeStamp || new Date().toISOString(),
                        DemandCancelId: payload.DemandCancelId || `demand-cancel-${Date.now()}`,
                    };

                    dbLookupSucceeded = true;
                    console.log(`✅ Enriched cancel payload:`, JSON.stringify(enrichedPayload, null, 2));
                } else {
                    console.warn(`⚠️ Booking NOT found in DB (conf: ${confirmationNumber}, resId: ${reservationId}). Using raw payload.`);
                }
            } else {
                console.warn(`⚠️ No ConfirmationNumber or ReservationId in payload. Cannot look up booking.`);
            }
        } catch (dbError: any) {
            console.error('❌ DB lookup failed, falling back to raw payload:', dbError.message);
        }

        if (!dbLookupSucceeded) {
            console.warn(`⚠️ Using raw/fallback payload for cancel:`, JSON.stringify(enrichedPayload, null, 2));
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
            const errorDesc = error.response?.data?.description || error.response?.data?.Description || error.message || "";

            // If RateGain throws "ConfirmationNumber(...) Number Invalid", it means the booking is already cancelled on their side.
            if ((error.response?.status === 400 || error.response?.status === 500) && (errorDesc.includes("Number Invalid") || errorDataStr.includes("Number Invalid"))) {
                console.log(`⚠️ RateGain says Number Invalid. Assuming booking is already cancelled on their end. Gracefully syncing local DB.`);
                rateGainResponse = {
                    status: true,
                    statusCode: 200,
                    body: {
                        cancellationNumber: "PREV-CANCELLED",
                        confirmationNumber: confirmationNumber || enrichedPayload.ConfirmationNumber,
                        status: "CANCELLED"
                    }
                };
            } else {
                throw error; // Rethrow actual failures
            }
        }

        // ─── Step 3: Update local DB status if cancellation succeeded ───
        try {
            if (rateGainResponse && (rateGainResponse.status === true || rateGainResponse.status === 'success')) {
                const targetId = confirmationNumber || reservationId || bookingId;
                if (targetId) {
                    const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(targetId));
                    const query: any = isObjectId ? { _id: targetId } : {
                        $or: [
                            { confirmationNumber: targetId },
                            { reservationId: targetId }
                        ]
                    };

                    const updated = await BookingModel.findOneAndUpdate(
                        query,
                        { 
                            status: BookingStatus.CANCELLED,
                            cancelCharge: cancelChargesInfo?.applicableCharge !== undefined ? cancelChargesInfo.applicableCharge : undefined,
                            cancelChargesInfo: cancelChargesInfo,
                            cancellationDetails: cancelChargesInfo?.cancellation 
                        },
                        { new: true }
                    );

                    if (updated) {
                        console.log(`✅ Updated local DB booking to CANCELLED: ${updated.confirmationNumber}`);
                    }
                }
            }
        } catch (dbError: any) {
            console.error('⚠️ local DB update failed (RateGain cancel was successful):', dbError.message);
        }

        if (rateGainResponse && typeof rateGainResponse === 'object') {
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
            throw new Error("Missing booking identifier (bookingId or confirmationNumber)");
        }

        const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(targetId));
        const query: any = isObjectId ? { _id: targetId } : {
            $or: [
                { confirmationNumber: targetId },
                { reservationId: targetId }
            ]
        };

        const booking = await BookingModel.findOne(query).lean();
        if (!booking) {
            throw new Error("Booking not found");
        }

        // Logic for TripJack
        const isTripJack = booking.provider === BookingProvider.TRIPJACK || payload.type === "HOTEL" || confirmationNumber?.startsWith("TJ") || confirmationNumber?.startsWith("TG");
        
        if (isTripJack) {
            // Try fetching latest details from TripJack to get the most accurate policy
            let tjDetails = null;
            try {
                const tjTargetId = booking.confirmationNumber || confirmationNumber || bookingId;
                tjDetails = await tripJackProvider.getBookingDetails(tjTargetId);
            } catch (err) {
                console.warn("[Cancel Service] Could not fetch latest booking details from TJ for cancel charges.", err);
            }

            const tjResp: any = tjDetails || booking.tripJackResponse || {};
            const policyData = tjResp?.order?.cancellationPolicy 
                || tjResp?.itemInfos?.[0]?.cancellationPolicy 
                || tjResp?.cancellationPolicy
                || tjResp?.itemInfos?.HOTEL?.ops?.[0]?.cnp
                || tjResp?.order?.itemInfos?.HOTEL?.ops?.[0]?.cnp
                || tjResp?.itemInfos?.HOTEL?.hInfo?.ops?.[0]?.cnp
                || tjResp?.order?.itemInfos?.HOTEL?.hInfo?.ops?.[0]?.cnp
                || tjResp?.order?.itemInfos?.[0]?.item?.cnp
                || tjResp?.itemInfos?.[0]?.item?.cnp;

            if (!policyData) {
                return {
                    status: true,
                    statusCode: 200,
                    description: "Cancellation policy not found. Cannot calculate exact charges.",
                    applicableCharge: null,
                    policy: null
                };
            }

            const now = new Date();
            let applicableCharge = 0;
            let chargeCurrency = "INR";
            
            if (policyData.pd && Array.isArray(policyData.pd) && policyData.pd.length > 0) {
                // TripJack v3 cnp.pd format
                const policies = [...policyData.pd].sort((a, b) => new Date(a.fdt).getTime() - new Date(b.fdt).getTime());
                
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
            } else if (policyData.cancelPolicyInfos && Array.isArray(policyData.cancelPolicyInfos) && policyData.cancelPolicyInfos.length > 0) {
                // Sort by time ascending
                const policies = [...policyData.cancelPolicyInfos].sort((a, b) => new Date(a.cancelTime).getTime() - new Date(b.cancelTime).getTime());
                
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
                    applicableCharge = policyData.noShowPolicy?.amount || policies[policies.length - 1].amount || 0;
                }
            } else if (policyData.policies && Array.isArray(policyData.policies)) {
                // Alternative TJ policy format
                const policies = [...policyData.policies].sort((a, b) => new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime());
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
                    applicableCharge = policies[policies.length - 1].cancellationCharge || policies[policies.length - 1].amount || 0;
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
                    amount: p.am
                }));
            } else if (policyData.cancelPolicyInfos && Array.isArray(policyData.cancelPolicyInfos)) {
                unifiedPenalties = policyData.cancelPolicyInfos.map((p: any, index: number, arr: any[]) => ({
                    from: p.cancelTime,
                    to: arr[index + 1] ? arr[index + 1].cancelTime : (booking.checkIn ? new Date(booking.checkIn).toISOString() : null),
                    amount: p.amount
                }));
            } else if (policyData.policies && Array.isArray(policyData.policies)) {
                unifiedPenalties = policyData.policies.map((p: any, index: number, arr: any[]) => ({
                    from: p.fromDate,
                    to: p.toDate || (arr[index + 1] ? arr[index + 1].fromDate : (booking.checkIn ? new Date(booking.checkIn).toISOString() : null)),
                    amount: p.cancellationCharge || p.amount
                }));
            }

            const isRefundable = policyData.ifra !== undefined ? policyData.ifra : (policyData.inra === false ? true : true);
            const deadlineDateTime = tjResp?.order?.itemInfos?.[0]?.item?.ddt 
                                  || tjResp?.itemInfos?.[0]?.item?.ddt 
                                  || tjResp?.order?.lastCancellationDate 
                                  || policyData.deadline 
                                  || null;

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
                    penalties: unifiedPenalties
                },
                deadlineDateTime,
                policy: policyData,
                calculationTime: now.toISOString()
            };
        }

        // RateGain Logic (not supported yet)
        return {
            status: false,
            statusCode: 400,
            description: "Previewing cancellation charges for RateGain is currently unsupported.",
        };
    }
}

export const cancelService = new CancelService();
