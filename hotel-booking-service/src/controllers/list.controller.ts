import { Request, Response } from "express";
import { listService } from "../services/list.service";

export const listController = async (req: any, res: Response) => {
    try {
        const { status, page, limit } = req.query;
        const agentId = req.user?.userId || req.user?.id || req.user?._id;
        const roles = req.user?.roles || [];
        const clientType = req.user?.clientType;
        
        // Only B2B users with explicit admin roles should be able to fetch all bookings
        const isAdmin = clientType === "B2B" && (roles.includes("B2B_ADMIN") || roles.includes("ADMIN"));
        console.log(`[FORENSIC] req.user:`, JSON.stringify(req.user));

        if (!isAdmin && !agentId) {
            return res.status(403).json({
                status: false,
                statusCode: 403,
                description: "Unauthorized: Missing user identification",
                body: null
            });
        }

        const data = await listService.list({
            status: status as string | undefined,
            page: page ? parseInt(page as string, 10) : undefined,
            limit: limit ? parseInt(limit as string, 10) : undefined,
            agentId: isAdmin ? undefined : agentId, // Only filter by agentId if NOT admin
        });
        console.log(`[FORENSIC] List Bookings: isAdmin=${isAdmin}, agentId=${agentId}, count=${data.body?.bookings?.length || 0}`);
        res.json(data);
    } catch (error: any) {
        console.error("List Controller Error:", error.message);
        res.status(500).json({
            status: false,
            statusCode: 500,
            description: error.message || "Internal Server Error",
            stack: error.stack,
            body: null,
        });
    }
};
