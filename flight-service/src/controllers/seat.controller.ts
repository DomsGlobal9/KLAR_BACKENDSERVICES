import { Request, Response } from "express";
import SeatService from "../services/seat.service";

class SeatController {

    async getSeats(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "Booking Id required"
                });
            }

            const result = await SeatService.getSeats(bookingId);

            return res.json({
                success: true,
                data: result.data
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default new SeatController();