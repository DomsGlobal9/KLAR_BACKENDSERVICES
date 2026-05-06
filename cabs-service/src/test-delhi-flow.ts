import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";
import { bookingService } from "./services/booking.service";
import { CabBookingModel, CabBookingStatus } from "./models/CabBooking.model";
import { v4 as uuidv4 } from "uuid";
import { env } from "./config/env";

async function testDelhiCompleteFlow() {
    console.log("🚀 Starting Cabs Delhi Full Flow E2E Test...\n");
    const correlationId = uuidv4();

    try {
        const directUri = "mongodb://domsgloballlp_Klar_Auth:EqPiFeGcACd0BW5y@ac-gfbeix5-shard-00-00.ynuvafo.mongodb.net:27017,ac-gfbeix5-shard-00-01.ynuvafo.mongodb.net:27017,ac-gfbeix5-shard-00-02.ynuvafo.mongodb.net:27017/cabs-service?authSource=admin&replicaSet=atlas-488qi1-shard-0&tls=true";
        console.log("⏳ Connecting to MongoDB...");
        await mongoose.connect(directUri);
        console.log("✅ DB Connected.\n");

        // 1. Google Places
        const sourceInput = "Indira Gandhi International Airport, Delhi";
        const destInput = "New Delhi Railway Station";
        console.log(`1️⃣ [Location] Searching for source: "${sourceInput}"...`);
        const sourceRes = await tripJackCabsProvider.googlePlaces(sourceInput);
        console.log("DEBUG [Location Search - Response]:", JSON.stringify(sourceRes, null, 2));
        
        const sourcePlace = sourceRes.data?.places?.[0];
        if (!sourcePlace) throw new Error("Source location not found");

        console.log(`🔍 [Location] Searching for destination: "${destInput}"...`);
        const destRes = await tripJackCabsProvider.googlePlaces(destInput);
        console.log("DEBUG [Location Search Dest - Response]:", JSON.stringify(destRes, null, 2));
        const destPlace = destRes.data?.places?.[0];
        if (!destPlace) throw new Error("Destination location not found");

        // 2. Lat/Long
        console.log(`2️⃣ [Coordinates] Fetching Lat/Long...`);
        const sourceLLRes = await tripJackCabsProvider.getLatLong(sourcePlace.id);
        const destLLRes = await tripJackCabsProvider.getLatLong(destPlace.id);
        console.log("DEBUG [LatLong Source - Response]:", JSON.stringify(sourceLLRes, null, 2));
        console.log("DEBUG [LatLong Dest - Response]:", JSON.stringify(destLLRes, null, 2));
        
        const sLL = sourceLLRes.data?.location;
        const dLL = destLLRes.data?.location;
        if (!sLL || !dLL) throw new Error("Could not retrieve coordinates");

        // 3. Quotes
        console.log(`3️⃣ [Quotes] Fetching vehicle quotes...`);
        const quotePayload: any = {
            correlationId,
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
        console.log("DEBUG [Quotes - Request]:", JSON.stringify(quotePayload, null, 2));
        const quotesRes = await tripJackCabsProvider.getQuotes(quotePayload);
        console.log("DEBUG [Quotes - Response]:", JSON.stringify(quotesRes, null, 2));
        
        if (!quotesRes.success) throw new Error("Quotes API failed");
        const categories = quotesRes.data?.quotesInfo || [];
        if (categories.length === 0) throw new Error("No quotes available");
        
        const firstCategory = categories[0];
        const firstQuote = firstCategory.quotes?.[0] || firstCategory.quoteList?.[0];
        const journeyInfo = quotesRes.data.journeyInfo;
        const routeDetails = quotesRes.data.routeDetails;

        const netNum = Number(firstQuote.fareBreakup?.totalFare || firstQuote.pricing?.totalAmount || 0);
        const taxNum = Number(firstQuote.fareBreakup?.totalTax || 0);
        const grossNum = netNum + taxNum;

        const netStr = netNum.toFixed(2);
        const taxStr = taxNum.toFixed(2);
        const grossStr = grossNum.toFixed(2);

        // 4. Booking
        console.log(`4️⃣ [Booking] Creating booking...`);
        const bookingPayload = {
            correlationId,
            journeyInfo: {
                journeyType: journeyInfo.journeyType,
                tripType: journeyInfo.tripType,
                pickupDateTime: "2026-06-23T10:00:00", 
                distance: journeyInfo.distance,
                duration: journeyInfo.duration
            },
            routeDetail: {
                isDomestic: routeDetails.isDomestic || true,
                origin: routeDetails.origin,
                destination: routeDetails.destination
            },
            quotationInfo: {
                vehicleType: firstCategory.vehicleType,
                vehicleCategory: firstCategory.vehicleCategory,
                quoteId: String(firstQuote.quotationId),
                childQuoteId: String(firstQuote.quoteChildId || firstQuote.quotationId), 
                paxCount: Number(firstCategory.paxCapacity || 3),
                luggageCount: Number(firstCategory.luggageCapacity || 2),
                vendorId: Number(firstQuote.vendorId)
            },
            pricingInfo: {
                netAmount: netStr, 
                addonsPrice: "0.00",
                tjTaxAmount: taxStr,
                agentMarkup: 0,
                agentMarkupSplitup: { onwardJourneyMarkup: 0, returnJourneyMarkup: 0 },
                grossAmount: grossStr,
                tjManagementFee: "0.00"
            },
            passengerDetail: {
                firstName: "Delhi",
                lastName: "User",
                email: "delhi.user@example.com",
                phone: "+919876543210"
            },
            consent: "yes"
        };
        console.log("DEBUG [Booking - Request]:", JSON.stringify(bookingPayload, null, 2));
        const bookingRes = await bookingService.book(bookingPayload);
        console.log("DEBUG [Booking - Response]:", JSON.stringify(bookingRes, null, 2));
        
        const bookingId = bookingRes.data?.id || bookingRes.data?.bookingId;
        if (!bookingId) throw new Error("Booking failed");
        console.log(`✅ Booking Created: ${bookingId}`);

        // 5. Payment (Dummy Payment to confirm flow)
        console.log(`5️⃣ [Payment] Creating payment for booking: ${bookingId}...`);
        const paymentPayload = {
            amount: grossNum,
            payUserId: env.tripJack.agencyId || "312879",
            paymentMedium: "WALLET",
            bookingId: bookingId,
            opType: "DEBIT",
            product: "CAB",
            transactionType: "PAID_FOR_ORDER",
            correlationId
        };
        console.log("DEBUG [Payment - Request]:", JSON.stringify(paymentPayload, null, 2));
        const paymentRes = await tripJackCabsProvider.createPayment(paymentPayload);
        console.log("DEBUG [Payment - Response]:", JSON.stringify(paymentRes, null, 2));
        
        if (!paymentRes.success) {
            console.warn("⚠️ Payment failed or dummy environment rejected it. Continuing to see if amendment works...");
        } else {
            console.log("✅ Payment SUCCESS!");
        }

        // 6. Booking Details
        console.log(`6️⃣ [Details] Fetching details for: ${bookingId}...`);
        const detailsRes = await tripJackCabsProvider.getBookingDetails(bookingId);
        console.log("DEBUG [Details - Response]:", JSON.stringify(detailsRes, null, 2));

        // 7. Amendment Charges
        console.log(`7️⃣ [Amendment] Fetching CANCELLATION charges...`);
        const chargesRes = await tripJackCabsProvider.getAmendmentCharges(bookingId, "CANCELLATION");
        console.log("DEBUG [Amendment Charges - Response]:", JSON.stringify(chargesRes, null, 2));

        // 8. Cancellation
        console.log(`8️⃣ [Cancellation] Processing cancellation...`);
        const cancelPayload = {
            bookingId,
            amendmentType: "CANCELLATION",
            correlationId
        };
        console.log("DEBUG [Cancellation - Request]:", JSON.stringify(cancelPayload, null, 2));
        const cancelRes = await tripJackCabsProvider.processAmendment(cancelPayload);
        console.log("DEBUG [Cancellation - Response]:", JSON.stringify(cancelRes, null, 2));

        if (cancelRes.success) {
            console.log(`✅ Cancellation SUCCESS!`);
            const dbBooking = await CabBookingModel.findOne({ bookingId });
            if (dbBooking) {
                dbBooking.status = CabBookingStatus.CANCELLED;
                await dbBooking.save();
                console.log(`✅ DB Record updated to CANCELLED.`);
            }
        }

    } catch (error: any) {
        console.error(`\n❌ TEST FAILED:`, error.message || error);
        if (error.data) console.error("Details:", JSON.stringify(error.data, null, 2));
    } finally {
        await mongoose.disconnect();
        console.log("\n👋 Delhi Flow Test Finished.");
    }
}

testDelhiCompleteFlow();
