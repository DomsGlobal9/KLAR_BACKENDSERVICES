import {
  BookingModel,
  BookingStatus,
  IBooking,
  BookingProvider,
} from "../models/Booking.model";
import { FilterQuery, UpdateQuery } from "mongoose";

export class HotelBookingRepository {
  /**
   * Create a new hotel booking
   */
  async createBooking(bookingData: Partial<IBooking>): Promise<IBooking> {
    const bookingRecord = new BookingModel(bookingData);
    return await bookingRecord.save();
  }

  /**
   * Find one booking by query
   */
  async findOne(query: FilterQuery<IBooking>, lean = false): Promise<any> {
    if (lean) {
      return await BookingModel.findOne(query).lean();
    }
    return await BookingModel.findOne(query);
  }

  /**
   * Find multiple bookings by query
   */
  async find(
    query: FilterQuery<IBooking>,
    sort?: any,
    skip?: number,
    limit?: number,
    lean = false,
  ): Promise<any[]> {
    let req = BookingModel.find(query);
    if (sort) req = req.sort(sort);
    if (skip !== undefined) req = req.skip(skip);
    if (limit !== undefined) req = req.limit(limit);
    if (lean) req = req.lean() as any;
    return (await req) as any;
  }

  /**
   * Count bookings by query
   */
  async countDocuments(query: FilterQuery<IBooking>): Promise<number> {
    return await BookingModel.countDocuments(query);
  }

  /**
   * Find by ID and update
   */
  async findByIdAndUpdate(
    id: string,
    update: UpdateQuery<IBooking>,
    options?: any,
  ): Promise<IBooking | null> {
    return (await BookingModel.findByIdAndUpdate(id, update, options)) as any;
  }

  /**
   * Find one and update
   */
  async findOneAndUpdate(
    query: FilterQuery<IBooking>,
    update: UpdateQuery<IBooking>,
    options?: any,
  ): Promise<IBooking | null> {
    return (await BookingModel.findOneAndUpdate(query, update, options)) as any;
  }

  /**
   * Delete expired bookings
   */
  async deleteExpiredBookings(
    statuses: BookingStatus[],
    beforeDate: Date,
  ): Promise<number> {
    const result = await BookingModel.deleteMany({
      status: { $in: statuses },
      createdAt: { $lt: beforeDate },
    });
    return result.deletedCount;
  }
}

export const hotelBookingRepository = new HotelBookingRepository();
