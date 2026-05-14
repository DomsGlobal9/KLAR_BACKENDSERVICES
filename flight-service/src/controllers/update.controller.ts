import { Request, Response } from "express";
import UpdateService from "../services/update.service";
import { mapToUpdatePayload } from "../utils/mappers/update.mapper";
import { validateUpdatePayload } from "../utils/updateVerifier";

class UpdateController {
    async updateBooking(req: Request, res: Response) {
        try {
            const payload = req.body;

            validateUpdatePayload(payload);

            const mapped = mapToUpdatePayload(payload);

            const response = await UpdateService.update(mapped);

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
}

export default new UpdateController();