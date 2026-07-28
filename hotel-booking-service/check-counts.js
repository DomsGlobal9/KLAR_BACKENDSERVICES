const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/hotel-booking-service?retryWrites=true&w=majority';

async function checkCounts() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    // Define minimal schema just to query
    const bookingSchema = new mongoose.Schema({}, { strict: false });
    const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

    const counts = await Booking.aggregate([
      {
        $group: {
          _id: "$clientType",
          count: { $sum: 1 }
        }
      }
    ]);

    console.log("Hotel Booking Counts by Client Type:");
    console.log(JSON.stringify(counts, null, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkCounts();
