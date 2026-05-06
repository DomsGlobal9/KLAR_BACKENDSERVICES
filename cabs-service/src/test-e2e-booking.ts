import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";
import { bookingService } from "./services/booking.service";
import { CabBookingModel } from "./models/CabBooking.model";
import { env } from "./config/env";

async function testE2E() {
    console.log("🚀 Starting Cabs E2E Booking & Persistence Test...\n");

    try {
        const directUri = "mongodb://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@ac-gfbeix5-shard-00-00.ynuvafo.mongodb.net:27017,ac-gfbeix5-shard-00-01.ynuvafo.mongodb.net:27017,ac-gfbeix5-shard-00-02.ynuvafo.mongodb.net:27017/cabs-service?authSource=admin&replicaSet=atlas-488qi1-shard-0&tls=true";
        console.log("⏳ Connecting to DB (Direct)...");
        await mongoose.connect(directUri);
        console.log("✅ DB Connected.\n");

        const sourceInput = "Pune Airport";
        const destInput = "Pune Station Bus Stand";

        console.log(`1️⃣ Searching locations...`);
        const sourceRes = await tripJackCabsProvider.googlePlaces(sourceInput);
        const sourcePlace = sourceRes.data?.places?.[0];
        const destRes = await tripJackCabsProvider.googlePlaces(destInput);
        const destPlace = destRes.data?.places?.[0];

        if (!sourcePlace || !destPlace) throw new Error("Could not find locations");
        console.log(`✅ Source: ${sourcePlace.displayLabel}`);
        console.log(`✅ Dest: ${destPlace.displayLabel}\n`);

        console.log(`2️⃣ Fetching Lat/Long...`);
        const sourceLLRes = await tripJackCabsProvider.getLatLong(sourcePlace.id);
        const destLLRes = await tripJackCabsProvider.getLatLong(destPlace.id);
        const sLL = sourceLLRes.data?.location;
        const dLL = destLLRes.data?.location;
        console.log(`✅ Found coordinates.\n`);

        console.log(`3️⃣ Fetching Quotes...`);
        const queryDate = "2026-06-23 10:00";
        const quotePayload: any = {
            pickupDate: queryDate,
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

        const quotesRes = await tripJackCabsProvider.getQuotes(quotePayload);
        const firstQuote = quotesRes.data?.quotesInfo?.[0];
        if (!firstQuote) throw new Error("No quotes found for this route");
        console.log(`✅ Found ${quotesRes.data?.quotesInfo?.length} quotes. Selected: ${firstQuote.vehicleType}\n`);
        console.log("DEBUG: firstQuote keys:", Object.keys(firstQuote));
        
        const opt = firstQuote.quotes?.[0];
        if (!opt) {
            throw new Error("firstQuote.quotes[0] is undefined");
        }
        
        const bookingPayload = {
            journeyInfo: {
                pickupDate: queryDate,
                pickupTime: "10:00"
            },
            routeDetail: {
                origin: quotePayload.origin,
                destination: quotePayload.destination
            },
            quotationInfo: {
                vehicleType: firstQuote.vehicleType,
                vehicleCategory: firstQuote.vehicleCategory,
                quoteId: opt.quotationId,
                vendorId: opt.vendorId
            },
            pricingInfo: {
                grossAmount: opt.fareBreakup.totalFare,
                currency: "INR"
            },
            passengerDetail: {
                firstName: "Test",
                lastName: "User",
                email: "test.user@example.com",
                phone: "9876543210"
            }
        };

        const bookingRes = await bookingService.book(bookingPayload);
        const bId = bookingRes.data?.bookingId;
        
        if (bId) {
            console.log(`✅ Booking SUCCESS. ID: ${bId}\n`);
            
            console.log(`5️⃣ Verifying Persistence in MongoDB...`);
            // Wait a small bit for DB write if async (though we used await in service)
            const savedBooking = await CabBookingModel.findOne({ bookingId: bId });
            
            if (savedBooking) {
                console.log(`✨ SUCCESS: Booking found in database!`);
                console.log(`   - Status: ${savedBooking.status}`);
                console.log(`   - Origin: ${savedBooking.origin.displayAddress}`);
                console.log(`   - Amount: ${savedBooking.totalAmount} ${savedBooking.currency}`);
            } else {
                throw new Error("FAILED: Booking record not found in database.");
            }
        } else {
            console.log(`❌ Booking FAILED:`, JSON.stringify(bookingRes));
        }

    } catch (error: any) {
        console.error(`\n❌ TEST FAILED:`, error.message || error);
        if (error.data) console.error("Details:", JSON.stringify(error.data, null, 2));
    } finally {
        await mongoose.disconnect();
        console.log("\n👋 Test Finished.");
    }
}

testE2E();
