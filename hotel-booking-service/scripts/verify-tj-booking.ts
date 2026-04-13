import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

// Imports from the application
import { precheckService } from "../src/services/precheck.service";
import { commitService } from "../src/services/commit.service";
import { BookingModel } from "../src/models/Booking.model";
import { env } from "../src/config/env";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@klar.ynuvafo.mongodb.net/hotel-booking-service?retryWrites=true&w=majority";

async function runVerification() {
    console.log("🚀 Starting TripJack Booking Verification Script...");

    // 1. Connect to MongoDB
    console.log("⏳ Connecting to MongoDB...");
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("✅ MongoDB Connected!");
    } catch (err: any) {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    }

    const tjApiKey = process.env.TRIPJACK_API_KEY || env.tripJack.apiKey;
    const tjAgencyId = process.env.TRIPJACK_AGENCY_ID || env.tripJack.agencyId;
    const hmsBaseUrl = process.env.TRIPJACK_BASE_URL || env.tripJack.baseUrl;

    const headers = {
        "Content-Type": "application/json",
        "apikey": tjApiKey,
        "agencyId": tjAgencyId,
        "Accept": "application/json",
    };

    // 2. Fetch Delhi Hotel IDs
    console.log("🔍 Fetching Delhi hotel IDs from TripJack Static API...");
    const staticRes = await axios.post(
        "https://apitest.tripjack.com/hms/v1/fetch-static-hotels",
        {},
        { headers, timeout: 60000 }
    );

    const hotels = staticRes.data.hotelOpInfos || staticRes.data.hotels || [];
    const delhiHids = hotels
        .filter((h: any) => (h.address?.city?.name || h.city || "").toLowerCase().includes("delhi"))
        .slice(0, 50)
        .map((h: any) => String(h.tjHotelId || h.hotelId));

    if (delhiHids.length === 0) {
        console.error("❌ No Delhi hotels found in TripJack database.");
        await mongoose.disconnect();
        return;
    }
    console.log(`✅ Found ${delhiHids.length} Delhi hotels.`);

    // 3. Search for Live Availability
    const correlationId = uuidv4();
    const searchPayload = {
        checkIn: "2026-05-15",
        checkOut: "2026-05-16",
        rooms: [{ adults: 2 }],
        currency: "INR",
        nationality: "106",
        hids: delhiHids,
        correlationId,
    };

    console.log("\n--- [STEP 1: SEARCH] ---");
    console.log("Request:", JSON.stringify(searchPayload, null, 2));
    const searchRes = await axios.post(`${hmsBaseUrl}/hms/v3/hotel/listing`, searchPayload, { headers });
    const liveHotels = searchRes.data.hotels || [];
    console.log(`Response: Found ${liveHotels.length} hotels with live availability.`);

    if (liveHotels.length === 0) {
        console.error("❌ No hotels with live availability found.");
        await mongoose.disconnect();
        return;
    }

    // 4. Select a Hotel and Get Pricing
    const selectedHotel = liveHotels[0];
    const hid = selectedHotel.tjHotelId || selectedHotel.hotelId;
    console.log(`\n--- [STEP 2: PRICING] ---`);
    console.log(`Trying Hotel: ${selectedHotel.name} (HID: ${hid})`);

    const pricingPayload = {
        correlationId,
        hid: hid.toString(),
        checkIn: "2026-05-15",
        checkOut: "2026-05-16",
        rooms: [{ adults: 2 }],
        currency: "INR",
        nationality: "106",
    };

    const pricingRes = await axios.post(`${hmsBaseUrl}/hms/v3/hotel/pricing`, pricingPayload, { headers });
    const pricingData = pricingRes.data;
    const reviewHash = pricingData.reviewHash;
    const options = pricingData.options || [];

    if (options.length === 0) {
        console.error("❌ No room options available for this hotel.");
        await mongoose.disconnect();
        return;
    }

    const selectedOption = options[0];
    const optionId = selectedOption.optionId;

    // 5. REVIEW (PRECHECK) using Application Service
    const reviewPayload = {
        propertyId: `TJ:${hid}`,
        correlationId,
        optionId,
        reviewHash,
        hid: Number(hid),
    };

    console.log("\n--- [STEP 3: REVIEW / PRECHECK] ---");
    console.log("Input to PrecheckService:", JSON.stringify(reviewPayload, null, 2));

    let reviewResult;
    try {
        reviewResult = await precheckService.precheck(reviewPayload);
        console.log("Output from PrecheckService (Review Success!):", JSON.stringify(reviewResult, null, 2));
    } catch (err: any) {
        console.error("❌ Review API Failed:", err.response?.data || err.message);
        await mongoose.disconnect();
        return;
    }

    if (!reviewResult.bookingId) {
        console.error("❌ No bookingId returned from Review API.");
        await mongoose.disconnect();
        return;
    }

    const finalOption = reviewResult.body?.option || selectedOption;
    const finalPrice = finalOption.pricing?.totalPrice || selectedOption.price?.total || 0;

    // 6. BOOK (COMMIT) using Application Service
    const bookPayload = {
        propertyId: `TJ:${hid}`,
        bookingId: reviewResult.bookingId,
        hotelName: selectedHotel.name,
        roomName: finalOption.roomInfo?.[0]?.name || selectedOption.roomName,
        totalPrice: finalPrice,
        checkIn: "2026-05-15",
        checkOut: "2026-05-16",
        roomTravellerInfo: [
            {
                travellerInfo: [
                    {
                        ti: "Mr",
                        pt: "ADULT",
                        fN: "Siddharth",
                        lN: "Sharma",
                        pan: "ABCDE1234F"
                    },
                    {
                        ti: "Mrs",
                        pt: "ADULT",
                        fN: "Anjali",
                        lN: "Sharma"
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

    const bookOmsUrl = "https://apitest.tripjack.com/oms/v3/hotel/book";
    console.log("\n--- [STEP 4: BOOK / COMMIT] ---");
    console.log("Input to CommitService:", JSON.stringify(bookPayload, null, 2));
    console.log(`Using OMS Endpoint: ${bookOmsUrl}`);

    // We need to temporarily override the provider's client or just use raw axios for verification
    let commitResult;
    try {
        commitResult = await commitService.commit(bookPayload, "agent-123", "Delhi Agent");
        console.log("Output from CommitService (Book Success!):", JSON.stringify(commitResult, null, 2));
    } catch (err: any) {
        console.error("❌ Book API Failed:", err.response?.data || err.message);
        await mongoose.disconnect();
        return;
    }

    // 7. Verify Database Record
    console.log("\n--- [STEP 5: DB VERIFICATION] ---");
    const dbBooking = await BookingModel.findOne({ confirmationNumber: commitResult.bookingId });
    if (dbBooking) {
        console.log("✅ Booking found in Database!");
        console.log("DB Status:", dbBooking.status);
        console.log("Guest Name:", dbBooking.guestName);
    } else {
        console.error("❌ Booking NOT found in Database.");
    }

    // 8. Save Logs to File
    const documentation = {
        review: {
            request: reviewPayload,
            response: reviewResult
        },
        book: {
            request: bookPayload,
            response: commitResult
        }
    };

    const docPath = path.join(__dirname, "..", "tmp", "tj-booking-logs.json");
    if (!fs.existsSync(path.dirname(docPath))) fs.mkdirSync(path.dirname(docPath));
    fs.writeFileSync(docPath, JSON.stringify(documentation, null, 2));
    console.log(`\n📄 Payloads saved to ${docPath}`);

    console.log("\n✅ Verification Completed.");
    await mongoose.disconnect();
}

runVerification().catch(async (err) => {
    console.error("💥 Fatal Error:", err);
    await mongoose.disconnect();
});
