const mongoose = require('mongoose');
require('dotenv').config();

const hotelSchema = new mongoose.Schema({
    cityName: String,
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: [Number]
    }
});

const Hotel = mongoose.model('Hotel', hotelSchema, 'hotels');

async function checkCoords() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const hotels = await Hotel.find({ 
        cityName: { $regex: 'Mumbai', $options: 'i' } 
    }).lean();

    console.log(`Found ${hotels.length} hotels matching Mumbai`);

    const coords = {};
    hotels.forEach(h => {
        const c = h.location?.coordinates;
        const k = c ? `${c[1].toFixed(3)}_${c[0].toFixed(3)}` : 'none';
        coords[k] = (coords[k] || 0) + 1;
        if (coords[k] > 1) {
            // console.log(`Collision at ${k}: ${h.name || h.tjHotelId}`);
        }
    });

    const sorted = Object.entries(coords).sort((a, b) => b[1] - a[1]);
    console.log('Top coordinate groups:');
    console.log(JSON.stringify(sorted.slice(0, 10), null, 2));

    await mongoose.disconnect();
}

checkCoords().catch(console.error);
