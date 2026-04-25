import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/flight-service?retryWrites=true&w=majority";

async function checkDb() {
    try {
        console.log('Connecting to search_service DB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected!');
        
        const db = mongoose.connection.db;
        if (!db) throw new Error('DB not found');
        
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        
        // Try to find any booking to see its userId
        const booking = await db.collection('flightbookings').findOne({});
        if (booking) {
            console.log('Found an existing booking!');
            console.log('UserId used in DB:', booking.userId);
        } else {
            console.log('No bookings found in flightbookings collection.');
            
            // Check auth-service users if possible (if they share the connection or we can guess)
            // The URI says /flight-service but the log said Database: search_service
            console.log('Checking for any users in this DB...');
            const user = await db.collection('users').findOne({});
            if (user) {
                console.log('Found a user in this DB!');
                console.log('UserId:', user._id);
            }
        }
        
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkDb();
