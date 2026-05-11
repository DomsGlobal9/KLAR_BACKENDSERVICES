import mongoose from 'mongoose';
import { RGDestinationModel } from './src/models/RGDestination.model';
import { HotelModel } from './src/models/Hotel.model';
import dotenv from 'dotenv';

dotenv.config();

async function checkDuplicates() {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    const query = 'hyder';
    
    const destinations = await RGDestinationModel.find({
        destName: { $regex: query, $options: "i" }
    }).lean();

    console.log('--- RG Destinations ---');
    destinations.forEach(d => {
        console.log(`Name: "${d.destName}", Code: "${d.destCode}"`);
    });

    const hotels = await HotelModel.find({
        $or: [
            { cityName: { $regex: query, $options: "i" } }
        ]
    }).limit(10).lean();

    console.log('--- TJ Hotels (City Names) ---');
    const cities = [...new Set(hotels.map(h => h.cityName))];
    cities.forEach(c => {
        console.log(`City: "${c}"`);
    });

    await mongoose.disconnect();
}

checkDuplicates().catch(console.error);
