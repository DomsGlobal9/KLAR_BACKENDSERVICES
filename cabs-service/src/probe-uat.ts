import dotenv from "dotenv";
dotenv.config();

import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";
import { env } from "./config/env";

/** Read-only probe: hit each UAT endpoint a few times and report pass/fail. */
async function main() {
    console.log(`baseUrl=${env.tripJack.baseUrl} agencyId=${env.tripJack.agencyId} key=${env.tripJack.apiKey.slice(0, 10)}...`);

    for (let i = 1; i <= 3; i++) {
        try {
            const r = await tripJackCabsProvider.googlePlaces("IGI Airport Delhi");
            console.log(`places #${i}: OK (${r?.data?.places?.length || 0} results)`);
        } catch (e: any) {
            console.log(`places #${i}: FAIL ${e?.status} ${e?.message}`);
        }
    }

    try {
        const p = await tripJackCabsProvider.googlePlaces("IGI Airport Delhi");
        const placeId = p?.data?.places?.[0]?.id;
        const ll = await tripJackCabsProvider.getLatLong(placeId);
        console.log(`lat-long: OK`, JSON.stringify(ll?.data?.address));
    } catch (e: any) {
        console.log(`lat-long: FAIL ${e?.status} ${e?.message}`);
    }

    const pickup = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const pickupDate = `${pickup.getFullYear()}-${pad(pickup.getMonth() + 1)}-${pad(pickup.getDate())} 10:00`;
    try {
        const q = await tripJackCabsProvider.getQuotes({
            pickupDate,
            origin: {
                type: "location",
                lat: "28.5550838",
                long: "77.0844015",
                displayAddress: "IGI Airport Terminal 3 Metro Station, Delhi",
                address: { city: "New Delhi", country: "India", postalCode: "110037" },
            },
            destination: {
                type: "location",
                lat: "28.6304203",
                long: "77.21772159999999",
                displayAddress: "Connaught Place, New Delhi",
                address: { city: "New Delhi", country: "India", postalCode: "110001" },
            },
            journeyType: "AIRPORT_TRANSFER",
            tripType: "ONEWAY",
            passengers: 2,
            quoteFilter: { paxCount: 2 },
        });
        console.log(`quotes: OK (${q?.data?.quotesInfo?.length || 0} groups)`);
    } catch (e: any) {
        console.log(`quotes: FAIL ${e?.status} ${e?.message}`);
    }
}

main().catch((e) => {
    console.error("FAIL:", e?.message || e);
    process.exit(1);
});
