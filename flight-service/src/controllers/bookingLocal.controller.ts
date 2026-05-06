import { Request, Response } from "express";
import BookingService from "../services/bookingLocal.service";

class BookingLocalController {

    async createLocalBooking(req: Request, res: Response) {
        try {
            const result = await BookingService.createInitialBooking(req.body);

            return res.status(201).json({
                success: true,
                message: "Booking initialized successfully",
                data: result
            });

        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default new BookingLocalController();