import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { resolveForTJ } from "./src/services/destinationResolver";
import { HotelModel } from "./src/models/Hotel.model";
import { env } from "./src/config/env";

async function verify() {
    console.log("⏳ Connecting to DB...");
    await mongoose.connect(env.mongoUri);
    console.log("✅ Connected.");

    const query = "NEW DELHI India";
    console.log(`\n🔍 Testing resolveForTJ with query: "${query}"`);
    
    const hids = await resolveForTJ(query);
    console.log(`✅ Resolved to ${hids.length} hotel IDs.`);

    if (hids.length > 0) {
        const hotels = await HotelModel.find({ tjHotelId: { $in: hids.slice(0, 10) } }).lean();
        console.log("\n🏨 Samples of resolved hotels:");
        hotels.forEach(h => {
            console.log(`- ${h.name} (${h.cityName}, ${h.countryName})`);
        });

        const mismatchCities = hotels.filter(h => !h.cityName.toLowerCase().includes("delhi") && !h.name.toLowerCase().includes("delhi"));
        if (mismatchCities.length > 0) {
            console.log("\n❌ FAILED: Found hotels not matching 'Delhi':");
            mismatchCities.forEach(h => console.log(`  !! ${h.name} in ${h.cityName}`));
        } else {
            console.log("\n✨ SUCCESS: All sampled hotels seem correct!");
        }
    } else {
        console.log("❌ FAILED: No hotels found for New Delhi.");
    }

    await mongoose.disconnect();
}

verify().catch(console.error);
