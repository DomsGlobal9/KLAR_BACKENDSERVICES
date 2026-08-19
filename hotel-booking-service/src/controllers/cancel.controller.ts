import { Request, Response } from "express";
import { cancelService } from "../services/cancel.service";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

/**
 * Load the booking a cancel/charges request refers to and prove the caller owns it.
 *
 * Cancelling is destructive and moves money, so — unlike reading a booking by
 * its secret id — an anonymous caller is never enough. Returns the booking on
 * success, or null after writing the error response.
 */
const authorizeBookingAccess = async (
  req: any,
  res: Response,
): Promise<any | null> => {
  const targetId =
    req.body?.ConfirmationNumber ||
    req.body?.bookingId ||
    req.query?.ConfirmationNumber ||
    req.query?.bookingId;

  if (!targetId) {
    res.status(400).json({
      status: false,
      statusCode: 400,
      description: "A bookingId or ConfirmationNumber is required.",
      body: null,
    });
    return null;
  }

  const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(targetId));
  const query: any = isObjectId
    ? { _id: targetId }
    : {
        $or: [
          { klarBookingId: targetId },
          { confirmationNumber: targetId },
          { reservationId: targetId },
        ],
      };

  const booking = await hotelBookingRepository.findOne(query, true);
  if (!booking) {
    res.status(404).json({
      status: false,
      statusCode: 404,
      description: "Booking not found",
      body: null,
    });
    return null;
  }

  const userId = req.user?.userId || req.user?.id;
  const userEmail = req.user?.email?.toLowerCase();
  const roles = req.user?.roles || [];
  const isAdmin = roles.includes("B2B_ADMIN") || roles.includes("ADMIN");

  const isOwner =
    !!userId &&
    (booking.agentId === userId ||
      booking.userId === userId ||
      booking.userInfo?.id === userId);

  const isGuestOwner =
    !!userEmail && booking.guestEmail?.toLowerCase() === userEmail;

  if (!isAdmin && !isOwner && !isGuestOwner) {
    res.status(403).json({
      status: false,
      statusCode: 403,
      description: "Access denied. You do not own this booking.",
      body: null,
    });
    return null;
  }

  return booking;
};

export const cancelController = async (req: any, res: Response) => {
  try {
    const booking = await authorizeBookingAccess(req, res);
    if (!booking) return;

    const data = await cancelService.cancel(req.body);
    res.json(data);
  } catch (error: any) {
    console.error(
      "Cancel Controller Error:",
      error.response?.data || error.message,
    );
    // Supplier/axios errors are logged above but never leaked to the client.
    if (error.response) {
      return res.status(500).json({
        status: false,
        statusCode: 500,
        description:
          "We could not process the cancellation right now. Please try again or contact support.",
        body: null,
      });
    }
    res.status(error.statusCode || 500).json({
      status: false,
      statusCode: error.statusCode || 500,
      description: error.message || "Internal Server Error",
      body: null,
    });
  }
};

export const getCancelChargesController = async (req: any, res: Response) => {
  try {
    const booking = await authorizeBookingAccess(req, res);
    if (!booking) return;

    const data = await cancelService.getCancelCharges(req.query);
    res.json(data);
  } catch (error: any) {
    console.error(
      "Get Cancel Charges Error:",
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({
      status: false,
      statusCode: error.response?.status || 500,
      description:
        error.response?.data?.description ||
        error.message ||
        "Internal Server Error",
      body: error.response?.data || null,
    });
  }
};
