import { Request, Response } from "express";
import { bookingsService } from "../services/bookings.service";
import { hotelBookingRepository } from "../repositories/hotelBooking.repository";

export const checkBookingsByEmail = async (req: Request, res: Response) => {
  try {
    const email = req.params.email as string;
    if (!email) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        description: "Email is required",
        body: null
      });
    }
    const count = await hotelBookingRepository.countDocuments({
      guestEmail: email.toLowerCase()
    });
    res.json({
      status: true,
      statusCode: 200,
      body: {
        hasBookings: count > 0
      }
    });
  } catch (error: any) {
    console.error("Check Bookings by Email Error:", error.message);
    res.status(500).json({
      status: false,
      statusCode: 500,
      description: error.message || "Failed to check bookings",
      body: null
    });
  }
};

export const getBookings = async (req: any, res: Response) => {
  try {
    const agentId = req.user?.userId || req.user?.id || req.user?._id;
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes("B2B_ADMIN") || roles.includes("ADMIN");
    
    if (!isAdmin && !agentId) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        description: "Access denied. Valid user context required.",
        body: null,
      });
    }

    const bookings = await bookingsService.getAllBookings(isAdmin ? undefined : agentId);
    res.json({
      status: true,
      statusCode: 200,
      body: bookings,
    });
  } catch (error: any) {
    console.error("Get Bookings Error:", error.message);
    res.status(500).json({
      status: false,
      statusCode: 500,
      description: error.message || "Failed to fetch bookings",
      body: null,
    });
  }
};

export const getBookingDetails = async (req: any, res: Response) => {
  try {
    const id = req.params.id as string;
    const booking = await bookingsService.getBookingById(id);
    console.log(
      "27 bookigs.controller.ts getBookingDetails booking",
      JSON.stringify(booking),
    );

    if (!booking) {
      return res.status(404).json({
        status: false,
        statusCode: 404,
        description: "Booking not found",
        body: null,
      });
    }

    // Ownership Check
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email;
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes("B2B_ADMIN") || roles.includes("ADMIN");

    const isOwner = 
      booking.agentId === userId || 
      booking.userId === userId || 
      (userEmail && booking.guestEmail === userEmail);

    // If a user is logged in but doesn't own it, deny access.
    // If no user is logged in (req.user is undefined), allow access since they must know the exact secure ID.
    if (!isAdmin && !isOwner && req.user) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        description: "Access denied. You do not own this booking.",
        body: null,
      });
    }

    res.json({
      status: true,
      statusCode: 200,
      body: booking,
    });
  } catch (error: any) {
    console.error("Get Booking Details Error:", error.message);
    res.status(500).json({
      status: false,
      statusCode: 500,
      description: error.message || "Failed to fetch booking details",
      body: null,
    });
  }
};
