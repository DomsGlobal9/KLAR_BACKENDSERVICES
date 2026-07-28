import { Response, NextFunction } from "express";
import { amendService } from "../services/amend.service";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

/**
 * Prove the authenticated caller owns (or is an admin over) the booking being
 * amended. Modification changes dates/status and can trigger supplier amend
 * charges, so — like cancellation — it must never operate on a booking the
 * caller doesn't own, even with a valid token. Returns the booking or null
 * after writing the error response.
 */
const authorizeBookingAccess = async (
  req: any,
  res: Response,
  confirmationNumber?: string,
): Promise<any | null> => {
  if (!confirmationNumber) {
    res.status(400).json({
      status: false,
      message: "ConfirmationNumber is required",
    });
    return null;
  }

  const booking = await hotelBookingRepository.findOne(
    { 
      $or: [
        { klarBookingId: confirmationNumber },
        { confirmationNumber: confirmationNumber },
        { reservationId: confirmationNumber }
      ]
    },
    true,
  );
  if (!booking) {
    res.status(404).json({ status: false, message: "Booking not found" });
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
      message: "Access denied. You do not own this booking.",
    });
    return null;
  }

  return booking;
};

export const getModificationPolicy = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const confirmationNumber = req.query.confirmationNumber as string;
    const booking = await authorizeBookingAccess(req, res, confirmationNumber);
    if (!booking) return;

    const result = await amendService.getModificationPolicy(confirmationNumber);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getModificationPricing = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const booking = await authorizeBookingAccess(
      req,
      res,
      req.body?.confirmationNumber,
    );
    if (!booking) return;

    const result = await amendService.getModificationPricing(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const commitModification = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const booking = await authorizeBookingAccess(
      req,
      res,
      req.body?.confirmationNumber,
    );
    if (!booking) return;

    const result = await amendService.commitModification(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
