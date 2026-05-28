import { BookingModel, BookingProvider, BookingStatus } from "../models/Booking.model";

import { tripJackProvider } from "../providers/tripjack.provider";

class BookingsService {
    /**
     * Get all bookings from the database
     * In a real app, this would be filtered by user ID or email.
     */
    async getAllBookings() {
        try {
            const bookings = await BookingModel.find().sort({ createdAt: -1 });
            
            // Fire-and-forget background sync for any HELD or PENDING bookings
            setTimeout(() => {
                bookings.forEach(b => {
                    if ((b.status === BookingStatus.HELD || b.status === BookingStatus.PENDING) && b.provider === BookingProvider.TRIPJACK) {
                        this.getBookingById(b.confirmationNumber || b.reservationId).catch(() => {});
                    }
                });
            }, 100);

            return bookings;
        } catch (error: any) {
            console.error("Error fetching bookings:", error.message);
            throw error;
        }
    }

    /**
     * Get a specific booking by confirmation number or reservation ID
     */
    async getBookingById(id: string) {
        try {
            const query: any = {
                $or: [
                    { confirmationNumber: id },
                    { reservationId: id }
                ]
            };

            if (id.match(/^[0-9a-fA-F]{24}$/)) {
                query.$or.push({ _id: id });
            }

            let booking = await BookingModel.findOne(query);

            // Sync live status for HELD or PENDING bookings from TripJack
            if (booking && (booking.status === BookingStatus.HELD || booking.status === BookingStatus.PENDING) && booking.provider === BookingProvider.TRIPJACK) {
                try {
                    const tjDetails = await tripJackProvider.getBookingDetails(booking.confirmationNumber);
                    
                    if (tjDetails) {
                        const orderStatus = tjDetails?.order?.status;
                        const rsta = tjDetails?.itemInfos?.HOTEL?.ops?.[0]?.rsta;
                        let newStatus: BookingStatus = booking.status;
                        
                        if (orderStatus === 'SUCCESS' || rsta === 'S') {
                            newStatus = BookingStatus.CONFIRMED;
                        } else if (orderStatus === 'ON_HOLD' || rsta === 'O') {
                            newStatus = BookingStatus.HELD;
                        } else if (orderStatus === 'CANCELLED' || rsta === 'C' || tjDetails?.status?.description?.toLowerCase()?.includes('cancelled')) {
                            newStatus = BookingStatus.CANCELLED;
                        } else if (orderStatus === 'FAILED' || orderStatus === 'ABORTED') {
                            newStatus = BookingStatus.FAILED;
                        }
                        
                        if (newStatus !== booking.status) {
                            booking.status = newStatus;
                            // Optionally save the updated response payload
                            booking.tripJackResponse = tjDetails;
                            await booking.save();
                        }
                    }
                } catch (syncErr: any) {
                    console.error(`Failed to sync live status for booking ${id}:`, syncErr.message);
                }
            }

            return booking;
        } catch (error: any) {
            console.error("Error fetching booking:", error.message);
            throw error;
        }
    }
}

export const bookingsService = new BookingsService();
