import mongoose from "mongoose";
import { syncTJNationalities, syncTJDeletedHotels, syncTJHotels } from "../src/sync/tjHotelSync";
import { env } from "../src/config/env";

async function runSync() {
    console.log("Connecting to DB (forcing IPv4)...");
    await mongoose.connect(env.mongoUri, { 
        family: 4,
        serverSelectionTimeoutMS: 10000 
    });

    console.log("Connected.");

    await syncTJNationalities();
    
    // Test hotel sync too
    await syncTJHotels();
    
    // Sync deleted hotels from 7 days ago

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await syncTJDeletedHotels(sevenDaysAgo);

    console.log("Sync complete. Closing connection.");
    await mongoose.connection.close();
}

runSync().catch(console.error);
