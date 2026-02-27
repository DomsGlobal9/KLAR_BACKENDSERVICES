import { Request, Response } from "express";
import { commitService } from "../services/commit.service";

export const commitController = async (req: Request, res: Response) => {
    try {
        const data = await commitService.commit(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("Commit Controller Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.message || "Failed to commit booking",
            body: null
        });
    }
};
