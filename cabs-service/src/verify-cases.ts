import dotenv from "dotenv";
dotenv.config();
import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";
import { v4 as uuidv4 } from "uuid";

async function testCases() {
    console.log("🚀 Starting Cabs Dynamic Search Verification...\n");

    const cases = [
        {
            name: "Case 1: Pune Airport to Pune Bus Stand",
            source: "Pune Airport",
            dest: "Pune Bus Stand"
        },
        {
            name: "Case 2: Notting Hill to Westminster",
            source: "Notting Hill, London",
            dest: "Westminster, London"
        }
    ];

    for (const c of cases) {
        console.log(`--- 🚕 ${c.name} ---`);
        try {
            console.log(`🔍 Searching locations for ${c.source} and ${c.dest}...`);
            
            // 1. Source Location
            const sourceRes = await tripJackCabsProvider.googlePlaces(c.source);
            const sourcePlace = sourceRes.data?.places?.[0];
            if (!sourcePlace) throw new Error(`No place found for source: ${c.source}`);
            console.log(`✅ Source found: ${sourcePlace.displayLabel} (ID: ${sourcePlace.id})`);

            // 2. Dest Location
            const destRes = await tripJackCabsProvider.googlePlaces(c.dest);
            const destPlace = destRes.data?.places?.[0];
            if (!destPlace) throw new Error(`No place found for dest: ${c.dest}`);
            console.log(`✅ Destination found: ${destPlace.displayLabel} (ID: ${destPlace.id})`);

            // 3. Source LatLong
            const sourceLLRes = await tripJackCabsProvider.getLatLong(sourcePlace.id);
            const sLL = sourceLLRes.data?.location;
            if (!sLL) throw new Error(`No LatLong found for source: ${c.source}`);
            console.log(`📍 Source LL: ${sLL.lat}, ${sLL.lng}`);

            // 4. Dest LatLong
            const destLLRes = await tripJackCabsProvider.getLatLong(destPlace.id);
            const dLL = destLLRes.data?.location;
            if (!dLL) throw new Error(`No LatLong found for dest: ${c.dest}`);
            console.log(`📍 Dest LL: ${dLL.lat}, ${dLL.lng}`);

            // 5. Get Quotes
            console.log(`💰 Fetching quotes for 2026-06-23 10:00...`);
            const payload: any = {
                pickupDate: "2026-06-23 10:00",
                origin: {
                    type: "location",
                    displayAddress: sourcePlace.displayLabel,
                    lat: sLL.lat.toString(),
                    long: sLL.lng.toString(),
                    address: sourceLLRes.data?.address
                },
                destination: {
                    type: "location",
                    displayAddress: destPlace.displayLabel,
                    lat: dLL.lat.toString(),
                    long: dLL.lng.toString(),
                    address: destLLRes.data?.address
                },
                journeyType: "airport_transfer",
                tripType: "oneway",
                passengers: 1
            };

            const quotesRes = await tripJackCabsProvider.getQuotes(payload);
            
            if (quotesRes.status?.success || quotesRes.success) {
                const quotes = quotesRes.data?.quotesInfo || [];
                console.log(`✨ SUCCESS: Found ${quotes.length} vehicle categories.`);
                if (quotes.length > 0) {
                    console.log("DEBUG: First quote structure:", JSON.stringify(quotes[0], null, 2));
                }
                quotes.forEach((q: any) => {
                    const opt = q.quoteList?.[0];
                    const price = opt?.pricing?.grossAmount || opt?.pricing?.totalAmount || "N/A";
                    const currency = opt?.pricing?.currency || "INR";
                    console.log(`   - ${q.vehicleType} (${q.vehicleCategory}): ${price} ${currency}`);
                });
            } else {
                console.log(`❌ FAILED to get quotes:`, JSON.stringify(quotesRes));
            }

        } catch (err: any) {
            console.error(`❌ ERROR in ${c.name}:`, err.message || err);
            if (err.data) console.error("   Details:", JSON.stringify(err.data));
        }
        console.log("\n");
    }
}

testCases().catch(console.error);
