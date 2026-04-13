import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { env } from "../src/config/env";

const hmsClient = axios.create({
    baseURL: env.tripJack.baseUrl, // https://apitest-hms.tripjack.com
    headers: {
        "Content-Type": "application/json",
        "apikey": env.tripJack.apiKey,
        "agencyId": env.tripJack.agencyId,
        "Accept": "application/json",
    },
});

const omsClient = axios.create({
    baseURL: "https://apitest-oms.tripjack.com",
    headers: {
        "Content-Type": "application/json",
        "apikey": env.tripJack.apiKey,
        "agencyId": env.tripJack.agencyId,
        "Accept": "application/json",
    },
});

async function getHotelIds(city: string): Promise<string[]> {
    console.log(`🔍 Fetching ${city} hotel IDs from TripJack Static API...`);
    const res = await axios.post(
        "https://apitest.tripjack.com/hms/v1/fetch-static-hotels",
        {},
        {
            headers: {
                "Content-Type": "application/json",
                "apikey": env.tripJack.apiKey,
                "Accept": "application/json",
            },
            timeout: 60000,
        }
    );

    const hotels = res.data.hotelOpInfos || res.data.hotels || [];
    const filtered = hotels.filter((h: any) => {
        const cityName = (h.address?.city?.name || h.city || h.cityName || "").toLowerCase();
        return cityName.includes(city.toLowerCase());
    });

    console.log(`✅ Found ${filtered.length} ${city} hotels in the first page.`);
    return filtered.map((h: any) => String(h.tjHotelId));
}

async function runDemo() {
    console.log("🚀 Starting TripJack Booking Demo...");

    // 1. Try cities in order
    let hids: string[] = [];
    const cities = ["Goa", "Delhi", "Mumbai"];
    
    for (const city of cities) {
        hids = await getHotelIds(city);
        if (hids.length > 0) break;
    }

    if (hids.length === 0) {
        console.error("❌ No hotels found for Goa, Delhi or Mumbai.");
        return;
    }

    const firstHids = hids.slice(0, 50);
    const correlationId = uuidv4();
    const checkIn = "2026-04-25";
    const checkOut = "2026-04-26";

    // 2. SEARCH
    const searchPayload = {
        checkIn,
        checkOut,
        rooms: [{ adults: 2 }],
        currency: "INR",
        nationality: "106",
        hids: firstHids,
        correlationId,
    };

    console.log("\n--- [STEP 1: SEARCH] ---");
    console.log("PAYLOAD:", JSON.stringify(searchPayload, null, 2));
    
    const searchRes = await hmsClient.post("/hms/v3/hotel/listing", searchPayload);
    const hotels = searchRes.data.hotels || [];
    console.log(`RESPONSE: Found ${hotels.length} hotels with live availability.`);

    if (hotels.length === 0) {
        console.error("❌ No hotels with live availability found.");
        return;
    }

    // 3. FINDING A WORKABLE OPTION
    let reviewData: any = null;
    let selectedOption: any = null;
    let selectedHotel: any = null;

    for (const hotel of hotels) {
        const hid = hotel.tjHotelId || hotel.hotelId;
        console.log(`\n\n🔍 Trying Hotel: ${hotel.name} (HID: ${hid})...`);

        const pricingPayload = {
            correlationId,
            hid: hid.toString(),
            checkIn: "2026-05-10",
            checkOut: "2026-05-11",
            rooms: [{ adults: 2 }],
            currency: "INR",
            nationality: "106",
        };

        try {
            const pricingRes = await hmsClient.post("/hms/v3/hotel/pricing", pricingPayload);
            const pricingData = pricingRes.data;
            const reviewHash = pricingData.reviewHash;
            const options = pricingData.options || [];

            if (options.length === 0) {
                console.log(`   ⏭️ No options for this hotel.`);
                continue;
            }

            for (const option of options) {
                const optionId = option.optionId;
                console.log(`   ✨ Trying Option: ${option.roomName || 'Default Room'} (ID: ${optionId})`);

                const reviewPayload = {
                    correlationId,
                    optionId,
                    reviewHash,
                    hid: Number(hid),
                };

                try {
                    console.log("   --- [STEP 3: REVIEW / PRECHECK] ---");
                    console.log("   PAYLOAD:", JSON.stringify(reviewPayload, null, 2));

                    const reviewRes = await hmsClient.post("/hms/v3/hotel/review", reviewPayload);
                    reviewData = reviewRes.data;
                    
                    if (reviewData.bookingId) {
                        selectedOption = option;
                        selectedHotel = hotel;
                        console.log(`   ✅ REVIEW SUCCESS! Generated bookingId: ${reviewData.bookingId}`);
                        break;
                    }
                } catch (revErr: any) {
                    console.log(`   ❌ Review Failed: ${revErr.response?.data?.errors?.[0]?.message || revErr.message}`);
                }
            }

            if (reviewData) break;

        } catch (prcErr: any) {
            console.log(`   ❌ Pricing Failed: ${prcErr.message}`);
        }
    }

    if (!reviewData || !reviewData.bookingId) {
        console.error("❌ Failed to find any workable hotel/option combination.");
        return;
    }

    const bookingId = reviewData.bookingId;

    // 5. BOOK (COMMIT) - Using Hold mode (no paymentInfos)
    const bookPayload = {
        bookingId,
        type: "HOTEL",
        roomTravellerInfo: [
            {
                travellerInfo: [
                    {
                        ti: "Mr",
                        pt: "ADULT",
                        fN: "Test",
                        lN: "User",
                        pan: "ABCDE1234F" // Dummy PAN
                    },
                    {
                        ti: "Mrs",
                        pt: "ADULT",
                        fN: "Demo",
                        lN: "User"
                    }
                ]
            }
        ],
        deliveryInfo: {
            emails: ["test@klarhotels.com"],
            contacts: ["9876543210"],
            code: ["+91"]
        }
    };

    console.log("\n--- [STEP 4: BOOK / COMMIT (HOLD)] ---");
    console.log("PAYLOAD:", JSON.stringify(bookPayload, null, 2));

    try {
        const bookRes = await omsClient.post("/oms/v3/hotel/book", bookPayload);
        console.log("RESPONSE:", JSON.stringify(bookRes.data, null, 2));
        
        const finalBookingId = bookRes.data.bookingId;

        // 6. STATUS POLLING (Sample)
        console.log("\n--- [STEP 5: BOOKING DETAILS / STATUS] ---");
        const statusRes = await omsClient.post("/oms/v3/hotel/booking-details", { bookingId: finalBookingId });
        console.log("FINAL STATUS RESPONSE:", JSON.stringify(statusRes.data, null, 2));

    } catch (err: any) {
        console.error("❌ Booking Error:", err.response?.data || err.message);
    }

    console.log("\n✅ Demo Completed.");
}

runDemo().catch(async (err) => {
    console.error("💥 Fatal Error:", err.response?.data || err.message);
});
