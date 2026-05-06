import { Request, Response } from "express";
import AncillaryService from "../services/ancillary.service";

class AncillaryController {

    async getAncillaries(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;

            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    message: "sessionId is required"
                });
            }

            const data = await AncillaryService.getAncillaries(sessionId as string);

            return res.status(200).json({
                success: true,
                data
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default new AncillaryController();