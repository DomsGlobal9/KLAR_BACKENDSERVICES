const mongoose = require('mongoose');
require('dotenv').config();

const hotelSchema = new mongoose.Schema({
    tjHotelId: String,
    name: String,
    cityName: String,
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: [Number]
    }
});

const Hotel = mongoose.model('Hotel', hotelSchema, 'hotels');

async function analyze() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const hotels = await Hotel.find({ 
        cityName: { $regex: 'Mumbai', $options: 'i' } 
    }).limit(100).lean();

    console.log(`Analyzing ${hotels.length} hotels in Mumbai...`);

    const geoGroups = {};
    hotels.forEach(h => {
        const c = h.location?.coordinates;
        if (!c) return;
        const key = `${c[1].toFixed(3)}_${c[0].toFixed(3)}`;
        if (!geoGroups[key]) geoGroups[key] = [];
        geoGroups[key].push({ id: h.tjHotelId, name: h.name });
    });

    const collisions = Object.entries(geoGroups).filter(([k, list]) => list.length > 1);
    console.log(`Found ${collisions.length} coordinate collisions.`);
    
    collisions.forEach(([k, list]) => {
        console.log(`Coord ${k}: ${list.length} hotels`);
        list.slice(0, 3).forEach(h => console.log(`  - ${h.name} (${h.id})`));
    });

    await mongoose.disconnect();
}

analyze().catch(console.error);
