import { Request, Response } from "express";
import { commitService } from "../services/commit.service";

export const commitController = async (req: any, res: Response) => {
    try {
        const agentId = req.user?.userId || req.user?.id || req.user?._id || null;
        const agentName = req.user?.email || null; // Fallback to email if name isn't in token
        console.log(`[FORENSIC] Commit Booking: agentId=${agentId}, agentName=${agentName}`);
        const data = await commitService.commit(req.body, agentId, agentName);
        res.json(data);
    } catch (error: any) {
        console.error("Commit Controller Error:", error.response?.data || error.message);
        
        const errorData = error.response?.data || error.data;
        const errorMessage = errorData?.errors?.[0]?.message || 
                             errorData?.error?.message || 
                             errorData?.description || 
                             error.message || 
                             "Failed to commit booking";

        res.status(error.response?.status || error.status || 500).json({
            status: false,
            statusCode: error.response?.status || error.status || 500,
            description: errorMessage,
            body: errorData || null
        });
    }
};
