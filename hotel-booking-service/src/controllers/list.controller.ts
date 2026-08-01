import { Request, Response } from "express";
import { listService } from "../services/list.service";

export const listController = async (req: any, res: Response) => {
  try {
    const { status, page, limit } = req.query;
    const agentId = req.user?.userId || req.user?.id || req.user?._id;
    const roles =
      typeof req.user?.roles === "string"
        ? [req.user.roles]
        : req.user?.roles || [];
    const isAdmin = roles.includes("B2B_ADMIN") || roles.includes("ADMIN");
    const isGuest = roles.includes("GUEST") || req.user?.isGuest;
    const email = req.user?.email;
    console.log(`[FORENSIC] req.user:`, JSON.stringify(req.user));

    const clientType =
      req.headers["x-client-type"] || req.query.clientType || "B2C";

    const data = await listService.list({
      status: status as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      agentId: agentId,
      isGuest,
      email,
      clientType: clientType as string,
      isAdmin,
    });
    console.log(
      `[FORENSIC] List Bookings: isAdmin=${isAdmin}, agentId=${agentId}, count=${data.body?.bookings?.length || 0}`,
    );
    res.json(data);
  } catch (error: any) {
    // Log the stack server-side; never return it to the client.
    console.error("List Controller Error:", error.message, error.stack);
    res.status(500).json({
      status: false,
      statusCode: 500,
      description: "Failed to fetch bookings.",
      body: null,
    });
  }
};
