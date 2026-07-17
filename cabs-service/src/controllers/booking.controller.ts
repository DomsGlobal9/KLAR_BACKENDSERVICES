import { Response, NextFunction } from "express";
import { bookingService, BookingContext } from "../services/booking.service";
import { ClientType } from "../models/CabBooking.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Resolve the sales channel + actor from the request, mirroring hotel's commit
 * controller:
 *   • A valid agent token  -> B2B (unless the client explicitly overrides).
 *   • Logged-in customer    -> B2C.
 *   • No token / anonymous  -> GUEST.
 * The client may hint via the `x-client-type` header or `body.clientType`.
 */
function resolveContext(req: AuthenticatedRequest): BookingContext {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : "";

  const agentId = req.user?.userId || req.user?.id || req.user?._id || null;
  const agentName = req.user?.name || req.user?.email || null;

  const hinted = (
    (req.headers["x-client-type"] as string) ||
    req.body?.clientType ||
    req.user?.clientType ||
    "B2C"
  )
    .toString()
    .toUpperCase();

  let clientType: ClientType =
    hinted === "B2B" ? ClientType.B2B : hinted === "GUEST" ? ClientType.GUEST : ClientType.B2C;

  // A B2C claim with no authenticated user is really a guest. (A B2B claim with
  // no token is rejected downstream in the service.)
  if (clientType === ClientType.B2C && !agentId) {
    clientType = ClientType.GUEST;
  }

  const userInfo = {
    id: req.user?.userId || req.user?.id || req.user?._id || "",
    email: req.user?.email || "",
    phone: req.user?.phone || req.user?.number || req.user?.profile?.number || "",
    role: req.user?.role || req.user?.roles?.[0] || (clientType === ClientType.GUEST ? "b2c" : ""),
    clientType: clientType.toLowerCase(),
  };

  return { token, clientType, agentId, agentName, userInfo };
}

export const createBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ctx = resolveContext(req);
    console.log(
      `[CabsBooking] clientType=${ctx.clientType} agentId=${ctx.agentId || "-"} user=${ctx.userInfo?.email || "-"}`,
    );
    const result = await bookingService.book(req.body, ctx);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
