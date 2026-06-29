import mongoose, { Schema, Document } from "mongoose";

export interface IBookingEvent extends Document {
  bookingId: string;
  requestId: string;
  eventType: string; // PRECHECK_SUCCESS, WALLET_DEBITED, SUPPLIER_COMMIT, PRICE_CHANGED
  payload?: any;
  timestamp: Date;
}

const BookingEventSchema: Schema = new Schema({
  bookingId: { type: String, required: true },
  requestId: { type: String, required: true },
  eventType: { type: String, required: true },
  payload: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

export const BookingEventModel = mongoose.model<IBookingEvent>(
  "BookingEvent",
  BookingEventSchema,
);

export class BookingEventLogger {
  static async log(
    bookingId: string,
    requestId: string,
    eventType: string,
    payload?: any,
  ) {
    try {
      console.log(
        `[EVENT] ${eventType} for Booking: ${bookingId} (Req: ${requestId})`,
      );
      await BookingEventModel.create({
        bookingId,
        requestId,
        eventType,
        payload,
      });
    } catch (e) {
      console.error("Failed to log booking event", e);
    }
  }
}
