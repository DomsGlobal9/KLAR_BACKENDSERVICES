import mongoose from "mongoose";
import { BookingModel, BookingProvider } from "./models/Booking.model";
import { env } from "./config/env";

async function checkBookings() {
  console.log("Connecting to DB:", env.port);
  const dbUri =
    process.env.MONGODB_URI ||
    "mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/hotel-booking-service?retryWrites=true&w=majority";
  await mongoose.connect(dbUri);
  console.log("DB Connected.");

  const latestBookings = await BookingModel.find({
    provider: BookingProvider.TRIPJACK,
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  console.log("Latest TripJack Bookings:");
  for (const b of latestBookings) {
    console.log({
      id: b._id,
      confirmationNumber: b.confirmationNumber,
      reservationId: b.reservationId,
      status: b.status,
      hotelName: b.hotelName,
      createdAt: b.createdAt,
    });
  }

  await mongoose.disconnect();
}

checkBookings().catch(console.error);
