import dotenv from "dotenv";
dotenv.config();
import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";

async function testPayloadMinimal() {
    console.log("🚀 Testing MINIMAL payload for Dubai (Lat/Long only)...\n");

    const payload = {
        pickupDate: "2026-07-25 16:07", // User's date
        origin: {
            lat: "25.2532",
            long: "55.3657"
        },
        destination: {
            lat: "25.1972",
            long: "55.2744"
        },
        journeyType: "airport_transfer",
        tripType: "oneway",
        passengers: 1
    };

    try {
        console.log("Testing with date: 2026-07-25 16:07");
        const res = await tripJackCabsProvider.getQuotes(payload);
        console.log("Result (Minimal):", res.data?.quotesInfo?.length ? "SUCCESS" : "EMPTY (404/No Cabs)");

        console.log("\n🚀 Testing ROBUST payload for Dubai (Full metadata)...\n");
        const robustPayload = {
            ...payload,
            origin: {
                ...payload.origin,
                type: "location",
                displayAddress: "Dubai International Airport (DXB), Dubai, UAE",
                address: { city: "Dubai", country: "United Arab Emirates" }
            },
            destination: {
                ...payload.destination,
                type: "location",
                displayAddress: "Burj Khalifa, Dubai, UAE",
                address: { city: "Dubai", country: "United Arab Emirates" }
            }
        };
        const res2 = await tripJackCabsProvider.getQuotes(robustPayload);
        console.log("Result (Robust):", res2.data?.quotesInfo?.length ? "SUCCESS" : "EMPTY (404/No Cabs)");

    } catch (err: any) {
        console.error("Error during test:", err.message || err);
    }
}

testPayloadMinimal();
