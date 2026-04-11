const { hotelsService } = require('./dist/services/hotels.service');
const mongoose = require('mongoose');
require('dotenv').config();

async function verify() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const searchPayload = {
        destination: "Mumbai",
        checkin: "2026-04-03",
        checkout: "2026-04-08",
        rooms: [{ adults: 2, children: 0, childAges: [] }],
        currency: "INR",
        countryCode: "IN"
    };

    console.log('Running search for Mumbai...');
    const data = await hotelsService.searchHotels(searchPayload);
    
    console.log('Search Result Summary:');
    console.log(`- results.length: ${data.results.length}`);
    console.log(`- meta.tjCount: ${data.meta.tjCount}`);
    console.log(`- meta.rgCount: ${data.meta.rgCount}`);

    if (data.results.length > 1 || (data.meta.tjCount === 1 && data.results.length === 1)) {
        console.log('✅ SUCCESS: Result count looks reasonable.');
    } else if (data.meta.tjCount > 1 && data.results.length === 1) {
        console.log('❌ FAILURE: Results are still being aggressively deduped (tjCount > 1 but results = 1).');
    }

    // Check for altDeals
    const withAltDeal = data.results.filter(h => h.altDeal);
    console.log(`- properties with alt deals: ${withAltDeal.length}`);

    await mongoose.disconnect();
}

verify().catch(console.error);
