import { Request, Response } from "express";
import FareService from "../services/fare.service";

class FareController {

    async getFares(req: Request, res: Response) {
        try {
            const { sessionId, flightKey } = req.body;

            const data = await FareService.getFares(sessionId, flightKey);

            res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default new FareController();