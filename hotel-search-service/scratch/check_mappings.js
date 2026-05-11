
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const HotelSchema = new mongoose.Schema({}, { strict: false });
const Hotel = mongoose.model('Hotel', HotelSchema, 'hotels');

async function run() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-search-service');
        
        const tjCount = await Hotel.filter(h => h.cityName && h.cityName.toLowerCase().includes('hyderabad') && h.tjHotelId).length;
        // Wait, mongoose doesn't have .filter on the model.

        const tjCountDb = await Hotel.countDocuments({ 
            cityName: /hyderabad/i, 
            tjHotelId: { $exists: true, $ne: null, $ne: "" } 
        });
        
        const rgCountDb = await Hotel.countDocuments({ 
            cityName: /hyderabad/i, 
            rgHotelId: { $exists: true, $ne: null, $ne: "" } 
        });

        const bothCountDb = await Hotel.countDocuments({ 
            cityName: /hyderabad/i, 
            tjHotelId: { $exists: true, $ne: null, $ne: "" },
            rgHotelId: { $exists: true, $ne: null, $ne: "" }
        });

        console.log(`\nResults for Hyderabad:`);
        console.log(`- Hotels with TripJack IDs: ${tjCountDb}`);
        console.log(`- Hotels with RateGain IDs: ${rgCountDb}`);
        console.log(`- Hotels with BOTH (Ideal for comparison): ${bothCountDb}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
run();
