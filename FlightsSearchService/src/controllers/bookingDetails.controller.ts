import { Request, Response, NextFunction } from "express";
import { BookingDetails } from "../models/bookingDetails.model";
import { StoreUserDetailsRequest, UpdateBookingIdRequest } from "../interface/flight/bookingDetails.interface";


/**
 * Store user details with price ID (Step 1)
 * Called when user submits their details
 */
export const storeUserDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { priceId, bookingDetails }: StoreUserDetailsRequest = req.body;


        if (!priceId || !bookingDetails) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: priceId and bookingDetails"
            });
        }


        if (!bookingDetails.travellerInfo || bookingDetails.travellerInfo.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one traveller is required"
            });
        }


        const existingRecord = await BookingDetails.findOne({ priceId });

        if (existingRecord) {

            existingRecord.paymentInfos = bookingDetails.paymentInfos;
            existingRecord.travellerInfo = bookingDetails.travellerInfo;
            existingRecord.deliveryInfo = bookingDetails.deliveryInfo;
            existingRecord.contactInfo = bookingDetails.contactInfo;
            existingRecord.gstInfo = bookingDetails.gstInfo;
            existingRecord.status = 'PENDING';
            existingRecord.errorMessage = undefined;

            await existingRecord.save();

            return res.status(200).json({
                success: true,
                message: "User details updated successfully",
                data: {
                    priceId: existingRecord.priceId,
                    status: existingRecord.status
                }
            });
        }


        const bookingDetailsRecord = new BookingDetails({
            priceId,
            ...bookingDetails,
            status: 'PENDING'
        });

        await bookingDetailsRecord.save();

        return res.status(200).json({
            success: true,
            message: "User details stored successfully",
            data: {
                priceId: bookingDetailsRecord.priceId,
                status: bookingDetailsRecord.status
            }
        });

    } catch (error: any) {
        console.error("Error storing user details:", error);
        next(error);
    }
};

/**
 * Update booking ID when received from third-party (Step 2)
 * Called after your instant booking API returns bookingId
 */
export const updateBookingId = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { priceId, bookingId, thirdPartyResponse }: UpdateBookingIdRequest = req.body;

        if (!priceId || !bookingId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: priceId and bookingId"
            });
        }


        const bookingDetails = await BookingDetails.findOne({ priceId });

        if (!bookingDetails) {
            return res.status(404).json({
                success: false,
                message: "No record found for this price ID"
            });
        }


        bookingDetails.bookingId = bookingId;
        bookingDetails.status = 'COMPLETED';

        if (thirdPartyResponse) {
            bookingDetails.thirdPartyResponse = thirdPartyResponse;
        }

        await bookingDetails.save();

        return res.status(200).json({
            success: true,
            message: "Booking ID updated successfully",
            data: {
                priceId: bookingDetails.priceId,
                bookingId: bookingDetails.bookingId,
                status: bookingDetails.status
            }
        });

    } catch (error: any) {
        console.error("Error updating booking ID:", error);
        next(error);
    }
};

/**
 * Handle failed booking
 */
export const handleFailedBooking = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { priceId, errorMessage, thirdPartyResponse } = req.body;

        if (!priceId) {
            return res.status(400).json({
                success: false,
                message: "Missing required field: priceId"
            });
        }

        const bookingDetails = await BookingDetails.findOne({ priceId });

        if (!bookingDetails) {
            return res.status(404).json({
                success: false,
                message: "No record found for this price ID"
            });
        }

        bookingDetails.status = 'FAILED';
        bookingDetails.errorMessage = errorMessage || "Booking failed";

        if (thirdPartyResponse) {
            bookingDetails.thirdPartyResponse = thirdPartyResponse;
        }

        await bookingDetails.save();

        return res.status(200).json({
            success: true,
            message: "Booking failure recorded",
            data: {
                priceId: bookingDetails.priceId,
                status: bookingDetails.status
            }
        });

    } catch (error: any) {
        console.error("Error handling failed booking:", error);
        next(error);
    }
};

/**
 * Get booking details by price ID
 */
export const getBookingDetailsByPriceId = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { priceId } = req.params;

        const bookingDetails = await BookingDetails.findOne({ priceId });

        if (!bookingDetails) {
            return res.status(404).json({
                success: false,
                message: "No record found for this price ID"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Booking details retrieved successfully",
            data: {
                priceId: bookingDetails.priceId,
                bookingId: bookingDetails.bookingId,
                status: bookingDetails.status,
                userDetails: {
                    paymentInfos: bookingDetails.paymentInfos,
                    travellerInfo: bookingDetails.travellerInfo,
                    deliveryInfo: bookingDetails.deliveryInfo,
                    contactInfo: bookingDetails.contactInfo,
                    gstInfo: bookingDetails.gstInfo
                },
                createdAt: bookingDetails.createdAt,
                updatedAt: bookingDetails.updatedAt
            }
        });

    } catch (error: any) {
        console.error("Error getting booking details:", error);
        next(error);
    }
};

/**
 * Get booking details by booking ID (after it's generated)
 */
export const getBookingDetailsByBookingId = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { bookingId } = req.params;

        const bookingDetails = await BookingDetails.findOne({ bookingId });

        if (!bookingDetails) {
            return res.status(404).json({
                success: false,
                message: "No record found for this booking ID"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Booking details retrieved successfully",
            data: {
                priceId: bookingDetails.priceId,
                bookingId: bookingDetails.bookingId,
                status: bookingDetails.status,
                userDetails: {
                    paymentInfos: bookingDetails.paymentInfos,
                    travellerInfo: bookingDetails.travellerInfo,
                    deliveryInfo: bookingDetails.deliveryInfo,
                    contactInfo: bookingDetails.contactInfo,
                    gstInfo: bookingDetails.gstInfo
                }
            }
        });

    } catch (error: any) {
        console.error("Error getting booking details:", error);
        next(error);
    }
};