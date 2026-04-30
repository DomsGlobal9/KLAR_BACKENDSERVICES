import { Request, Response } from "express";
import BookingService from "../services/booking.service";
import { mapToTripjackBooking } from "../utils/mappers/booking.mapper";
import { validateBookingPayload } from "../utils/tripjackBookingVerifier";

class BookingController {

    async instantBook(req: Request, res: Response) {
        try {
            const payload = { ...req.body, isHold: false };

            validateBookingPayload(payload);

            const mapped = mapToTripjackBooking(payload);

            const response = await BookingService.book(mapped);

            return res.status(200).json({
                success: true,
                data: response.data,
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async holdBook(req: Request, res: Response) {
        try {
            const payload = { ...req.body, isHold: true };

            validateBookingPayload(payload);

            const mapped = mapToTripjackBooking(payload);

            const response = await BookingService.book(mapped);

            return res.status(200).json({
                success: true,
                data: response.data,
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async validateFare(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            const response = await BookingService.validateFare(bookingId);

            return res.status(200).json(response.data);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async confirm(req: Request, res: Response) {
        try {
            const { bookingId, amount } = req.body;

            const response = await BookingService.confirmBooking(
                bookingId,
                amount
            );
            return res.status(200).json(response.data);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getBookingDetails(req: Request, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required"
                });
            }

            const response = await BookingService.getBookingDetails(bookingId as string);

            return res.status(200).json({
                success: true,
                data: response
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Add to existing BookingController class

    async reissueBook(req: Request, res: Response) {
        try {
            const {
                bookingId,        
                oldBookingId,    
                amount,           
                travellerInfo,    
                deliveryInfo     
            } = req.body;

            // Validation
            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required (from review response)"
                });
            }

            if (!oldBookingId) {
                return res.status(400).json({
                    success: false,
                    message: "oldBookingId is required (original booking ID)"
                });
            }

            if (!amount) {
                return res.status(400).json({
                    success: false,
                    message: "amount is required (TF from review response)"
                });
            }

            if (!travellerInfo || !Array.isArray(travellerInfo) || travellerInfo.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "travellerInfo is required and must be a non-empty array"
                });
            }

            if (!deliveryInfo || !deliveryInfo.emails || !deliveryInfo.contacts) {
                return res.status(400).json({
                    success: false,
                    message: "deliveryInfo with emails and contacts is required"
                });
            }

            // Prepare payload for Tripjack reissue book API
            const payload: any = {
                bookingId: bookingId,
                oldBookingId: oldBookingId,
                paymentInfos: [
                    {
                        amount: amount
                    }
                ],
                travellerInfo: travellerInfo,
                deliveryInfo: deliveryInfo
            };

            // Add GST info if provided
            if (req.body.gstInfo) {
                payload.gstInfo = req.body.gstInfo;
            }

            // Add contact info (emergency) if provided
            if (req.body.contactInfo) {
                payload.contactInfo = req.body.contactInfo;
            }

            const response = await BookingService.reissueBook(payload);

            return res.status(200).json({
                success: true,
                data: response.data
            });

        } catch (error: any) {
            console.error("Reissue Book Controller ERROR >>>", error.message);

            return res.status(500).json({
                success: false,
                message: error.response?.data?.message || error.message || "Reissue booking failed"
            });
        }
    }
}

export default new BookingController();