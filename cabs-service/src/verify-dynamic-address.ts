import dotenv from "dotenv";
dotenv.config();

import { resolveAddress } from "./utils/location.utils";
import { searchService } from "./services/search.service";

/**
 * Read-only verification of dynamic address resolution + quotes.
 * No booking / payment / DB calls.
 */
async function main() {
    // 1. Dynamic address resolution — domestic
    const delhi = await resolveAddress("IGI Airport Terminal 3 Metro Station, Delhi");
    console.log("Resolved (Delhi):", JSON.stringify(delhi));

    // 2. Dynamic address resolution — international (would fail with old hardcoded parsing that defaults to India)
    const dubai = await resolveAddress("Museum of The Future, Sheikh Zayed Road, Dubai");
    console.log("Resolved (Dubai):", JSON.stringify(dubai));

    // 3. Cache hit (should be instant, no API call)
    const t0 = Date.now();
    await resolveAddress("IGI Airport Terminal 3 Metro Station, Delhi");
    console.log(`Cache hit took ${Date.now() - t0}ms`);

    // 4. Quotes with NO address supplied (booking precheck path) — the exact
    //    scenario that used to 404 with "No Cabs Found!".
    const pickup = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const pickupDate = `${pickup.getFullYear()}-${pad(pickup.getMonth() + 1)}-${pad(pickup.getDate())} 10:00`;

    const quotes = await searchService.getQuotes({
        pickupDate,
        from: "IGI Airport Terminal 3 Metro Station, Delhi",
        to: "Connaught Place, New Delhi",
        origin: { lat: "28.5550838", long: "77.0844015" },
        destination: { lat: "28.6304203", long: "77.21772159999999" },
        journeyType: "airport_transfer",
        tripType: "oneway",
        passengers: 2,
    });

    const groups = quotes?.data?.quotesInfo || [];
    console.log(`Quotes: success=${quotes?.success}, vehicleGroups=${groups.length}`);
    for (const g of groups.slice(0, 3)) {
        const q = g.quotes?.[0];
        console.log(`  - ${g.label}: totalFare=${q?.fareBreakup?.totalFare} quotationId=${q?.quotationId}`);
    }

    if (!groups.length) {
        console.error("FAIL: no quotes returned");
        process.exit(1);
    }
    console.log("PASS: dynamic address -> quotes flow works");
}

main().catch((e) => {
    console.error("FAIL:", e?.message || e);
    process.exit(1);
});
