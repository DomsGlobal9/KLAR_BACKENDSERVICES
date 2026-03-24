import { Request, Response } from "express";
import { precheckService } from "../services/precheck.service";

export const precheckController = async (req: Request, res: Response) => {
    try {
        const data = await precheckService.precheck(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("Precheck Controller Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.message || "Internal Server Error",
            body: null
        });
    }
};
