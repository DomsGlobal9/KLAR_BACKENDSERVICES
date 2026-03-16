import { FlightBookingModel, IFlightBooking, BookingStatus } from '../models/flightBooking.model';
import { Types } from 'mongoose';

export class FlightBookingRepository {
  
  async create(bookingData: Partial<IFlightBooking>): Promise<IFlightBooking> {
    const booking = new FlightBookingModel(bookingData);
    return await booking.save();
  }

  async findById(id: string): Promise<IFlightBooking | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return await FlightBookingModel.findById(id);
  }

  async findByBookingId(bookingId: string): Promise<IFlightBooking | null> {
    return await FlightBookingModel.findOne({ bookingId });
  }

  async findByUserId(userId: string, page: number = 1, limit: number = 10): Promise<{ data: IFlightBooking[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      FlightBookingModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FlightBookingModel.countDocuments({ userId })
    ]);
    return { data, total };
  }

  async updateStatus(id: string, status: BookingStatus, additionalData?: Partial<IFlightBooking>): Promise<IFlightBooking | null> {
    const updateData: Partial<IFlightBooking> = { status, ...additionalData };
    
    if (status === BookingStatus.CONFIRMED) {
      updateData.confirmedAt = new Date();
    } else if (status === BookingStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    return await FlightBookingModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
  }

  async updateByBookingId(bookingId: string, updateData: Partial<IFlightBooking>): Promise<IFlightBooking | null> {
    return await FlightBookingModel.findOneAndUpdate(
      { bookingId },
      { $set: updateData },
      { new: true }
    );
  }

  async findPendingBookings(hours: number = 24): Promise<IFlightBooking[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);
    
    return await FlightBookingModel.find({
      status: BookingStatus.PENDING,
      createdAt: { $lte: cutoffTime }
    });
  }

  async findByDateRange(startDate: Date, endDate: Date, status?: BookingStatus): Promise<IFlightBooking[]> {
    const query: any = {
      createdAt: { $gte: startDate, $lte: endDate }
    };
    if (status) {
      query.status = status;
    }
    return await FlightBookingModel.find(query).sort({ createdAt: -1 });
  }

  async getBookingStats(userId?: string): Promise<any> {
    const match: any = {};
    if (userId) {
      match.userId = userId;
    }

    return await FlightBookingModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);
  }
}