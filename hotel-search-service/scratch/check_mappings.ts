
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const HotelSchema = new mongoose.Schema({}, { strict: false });
const Hotel = mongoose.model('Hotel', HotelSchema, 'hotels');

async function run() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-search-service');
        
        const tjCount = await Hotel.countDocuments({ 
            cityName: /hyderabad/i, 
            tjHotelId: { $exists: true, $ne: null, $ne: "" } 
        });
        
        const rgCount = await Hotel.countDocuments({ 
            cityName: /hyderabad/i, 
            rgHotelId: { $exists: true, $ne: null, $ne: "" } 
        });

        const bothCount = await Hotel.countDocuments({ 
            cityName: /hyderabad/i, 
            tjHotelId: { $exists: true, $ne: null, $ne: "" },
            rgHotelId: { $exists: true, $ne: null, $ne: "" }
        });

        console.log(`\nResults for Hyderabad:`);
        console.log(`- Hotels with TripJack IDs: ${tjCount}`);
        console.log(`- Hotels with RateGain IDs: ${rgCount}`);
        console.log(`- Hotels with BOTH (Ideal for comparison): ${bothCount}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
run();
