import mongoose from 'mongoose';
import { BookingModel } from './src/models/Booking.model';

async function verify() {
  try {
    await mongoose.connect('mongodb+srv://Klar-Backend:q25hBfB5k619ZfON@klar-cluster.2pldbvl.mongodb.net/klar-db?retryWrites=true&w=majority&appName=Klar-cluster');
    const bookings = await BookingModel.find({ hotelName: /Fab/i }).sort({ createdAt: -1 }).limit(5).lean();
    bookings.forEach(b => console.log(b._id, b.hotelName, b.clientType, b.agentId, b.userId, b.guestEmail));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
verify();
