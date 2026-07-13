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
      guestEmail: email.trim().toLowerCase(),
      clientType: "GUEST"
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
    const email = req.user?.email;
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes("B2B_ADMIN") || roles.includes("ADMIN");
    
    const clientType = req.query.clientType as string;
    const query: any = {};
    
    if (!clientType) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        description: "clientType is required",
        body: null,
      });
    }
    
    query.clientType = clientType;

    if (!isAdmin) {
      if (clientType === 'B2B') {
        if (!agentId) {
          return res.status(403).json({
            status: false,
            statusCode: 403,
            description: "Access denied. Valid user context required.",
            body: null,
          });
        }
        query.agentId = agentId;
      } else if (clientType === 'B2C') {
        if (!agentId) {
          return res.status(403).json({
            status: false,
            statusCode: 403,
            description: "Access denied. Valid user context required.",
            body: null,
          });
        }
        if (email) {
          // A signed-up B2C user also owns the GUEST bookings they made on the
          // same email before registering. guestEmail is stored lowercased.
          query.$or = [
            { userId: agentId },
            { guestEmail: email.toLowerCase() },
          ];
          query.clientType = { $in: ['B2C', 'GUEST'] };
        } else {
          query.userId = agentId;
        }
      } else if (clientType === 'GUEST') {
        if (!email) {
          return res.status(403).json({
            status: false,
            statusCode: 403,
            description: "Access denied. Valid guest context required.",
            body: null,
          });
        }
        query.guestEmail = email.toLowerCase();
      } else {
        return res.status(403).json({
          status: false,
          statusCode: 403,
          description: "Invalid clientType",
          body: null,
        });
      }
    }

    const bookings = await bookingsService.getAllBookings(query);
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

    // Anonymous access is a capability URL: only the unguessable publicToken
    // grants it — never the semi-predictable _id, confirmation number or
    // reservation id. Logged-in owners are handled by the ownership check below.
    if (!req.user && booking.publicToken && booking.publicToken !== id) {
      return res.status(403).json({
        status: false,
        statusCode: 403,
        description: "Access denied.",
        body: null,
      });
    }

    // Ownership Check
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email?.toLowerCase();
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes("B2B_ADMIN") || roles.includes("ADMIN");

    const isOwner = 
      booking.agentId === userId || 
      booking.userId === userId || 
      (booking as any).userInfo?.id === userId ||
      (userEmail && booking.guestEmail?.toLowerCase() === userEmail);

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

    // Anonymous callers reach this by knowing the booking id (the guest
    // confirmation link). That is enough to see the stay, not enough to see who
    // booked it — strip the identity fields.
    const body: any = { ...booking };
    if (!req.user) {
      delete body.guestEmail;
      delete body.userInfo;
      delete body.userId;
      delete body.agentId;
    }

    res.json({
      status: true,
      statusCode: 200,
      body,
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
