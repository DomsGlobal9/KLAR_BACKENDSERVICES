import { Request, Response } from "express";
import { listService } from "../services/list.service";

export const listController = async (req: Request, res: Response) => {
    try {
        const { status, page, limit } = req.query;
        const data = await listService.list({
            status: status as string | undefined,
            page: page ? parseInt(page as string, 10) : undefined,
            limit: limit ? parseInt(limit as string, 10) : undefined,
        });
        res.json(data);
    } catch (error: any) {
        console.error("List Controller Error:", error.message);
        res.status(500).json({
            status: false,
            statusCode: 500,
            description: error.message || "Internal Server Error",
            body: null,
        });
    }
};
