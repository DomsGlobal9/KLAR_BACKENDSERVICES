import dotenv from "dotenv";
dotenv.config();

import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";
import { env } from "./config/env";

/**
 * UAT-ONLY full supplier flow: quote -> booking -> payment -> details.
 * Sandbox bookings move no real money. Refuses to run against live.
 */
async function main() {
    if (!env.tripJack.baseUrl.includes("apitest")) {
        throw new Error("Refusing to run: baseUrl is not the UAT environment.");
    }

    const pickup = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const pickupDate = `${pickup.getFullYear()}-${pad(pickup.getMonth() + 1)}-${pad(pickup.getDate())} 10:00`;

    const origin = {
        type: "location",
        lat: "28.5550838",
        long: "77.0844015",
        displayAddress: "IGI Airport Terminal 3 Metro Station, Delhi",
        address: { city: "New Delhi", country: "India", postalCode: "110037" },
    };
    const destination = {
        type: "location",
        lat: "28.6304203",
        long: "77.21772159999999",
        displayAddress: "Connaught Place, New Delhi",
        address: { city: "New Delhi", country: "India", postalCode: "110001" },
    };

    // 1. Quote
    const q = await tripJackCabsProvider.getQuotes({
        pickupDate,
        origin,
        destination,
        journeyType: "AIRPORT_TRANSFER",
        tripType: "ONEWAY",
        passengers: 2,
        quoteFilter: { paxCount: 2 },
    });
    const group = q?.data?.quotesInfo?.[0];
    const quote = group?.quotes?.[0];
    if (!quote) throw new Error("No quotes returned");
    const total = Number(quote.fareBreakup?.totalFare || 0) + Number(quote.fareBreakup?.totalTax || 0);
    console.log(`1. quote OK: ${group.label} quotationId=${quote.quotationId} child=${quote.quoteChildId} total=${total}`);

    // 2. Booking
    const bookingRes = await tripJackCabsProvider.createBooking({
        journeyInfo: {
            journeyType: "AIRPORT_TRANSFER",
            tripType: "ONEWAY",
            pickupDateTime: q.data.journeyInfo?.pickupDateTime || `${pickupDate.replace(" ", "T")}:00`,
            distance: q.data.journeyInfo?.distance || "19 Km",
            duration: Number(q.data.journeyInfo?.duration || 38),
        },
        routeDetail: { isDomestic: true, origin, destination },
        addons: [],
        quotationInfo: {
            vehicleType: group.vehicleType,
            vehicleCategory: group.vehicleCategory,
            quoteId: String(quote.quotationId),
            childQuoteId: String(quote.quoteChildId),
            paxCount: Number(quote.paxCount || 2),
            luggageCount: Number(quote.luggageCount || 2),
            vendorId: Number(quote.vendorId || 1),
        },
        pricingInfo: {
            // netAmount must be the FARE ONLY, matching the quote exactly.
            netAmount: Number(quote.fareBreakup?.totalFare || 0).toFixed(2),
            addonsPrice: "0.00",
            tjTaxAmount: Number(quote.fareBreakup?.totalTax || 0).toFixed(2),
            tjManagementFee: "0.00",
            agentMarkup: 0,
            agentMarkupSplitup: { onwardJourneyMarkup: 0, returnJourneyMarkup: 0 },
            grossAmount: total.toFixed(2),
        },
        passengerDetail: {
            firstName: "Sudheer",
            lastName: "Ganta",
            email: "gmsaisudheer@gmail.com",
            phone: "+919396444455",
        },
        serviceRequest: "",
        consent: "yes",
        agentEmail: "gmsaisudheer@gmail.com",
        agentPhone: "+919396444455",
        agentId: Number(env.tripJack.agencyId),
        vendorId: Number(quote.vendorId || 1),
    });
    const bookingId = bookingRes?.data?.id;
    console.log(`2. booking OK: id=${bookingId} status=${bookingRes?.data?.status} totalPrice=${bookingRes?.data?.totalPrice}`);
    if (!bookingId) throw new Error("No booking id");

    // 3. Payment (sandbox)
    try {
        const payRes = await tripJackCabsProvider.createPayment({
            bookingId,
            amount: Number(bookingRes?.data?.totalPrice || total),
            paymentMedium: "WALLET",
            opType: "DEBIT",
            product: "CAB",
            transactionType: "PAID_FOR_ORDER",
            payUserId: env.tripJack.agencyId,
        });
        console.log(`3. payment: success=${payRes?.success}`, JSON.stringify(payRes?.data || payRes));
    } catch (e: any) {
        console.log(`3. payment FAIL: ${e?.status} ${e?.message}`, JSON.stringify(e?.data || {}));
    }

    // 4. Details
    await new Promise((r) => setTimeout(r, 3000));
    const det = await tripJackCabsProvider.getBookingDetails(bookingId);
    const order = det?.data?.[0]?.order;
    console.log(`4. details: status=${order?.status} paymentStatus=${order?.paymentStatus}`);
}

main().catch((e) => {
    console.error("FAIL:", e?.message || e, JSON.stringify(e?.data || {}));
    process.exit(1);
});
