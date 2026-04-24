const jwt = require("jsonwebtoken");
const fs = require("fs");

let log = [];

function record(step, type, data) {
    console.log(`[${step}] Record ${type}...`);
    log.push({
        step,
        type,
        timestamp: new Date().toISOString(),
        data: data
    });
}

const TOKEN = jwt.sign(
    { id: "test-user", role: "user", email: "test@domain.com" },
    "your_super_secret_jwt_key_change_me_in_production",
    { expiresIn: "1h" }
);

const HEADERS = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${TOKEN}`
};

async function call(url, method, body, query = null) {
    let finalUrl = url;
    if (query) {
        const params = new URLSearchParams(query).toString();
        finalUrl += `?${params}`;
    }
    const payload = { method, headers: HEADERS };
    if (body) payload.body = JSON.stringify(body);
    
    record("API_CALL", "REQUEST", { url: finalUrl, method, body });
    try {
        const response = await fetch(finalUrl, payload);
        const data = await response.json();
        record("API_CALL", "RESPONSE", { url: finalUrl, status: response.status, data });
        return data;
    } catch (e) {
        record("API_CALL", "ERROR", { url: finalUrl, error: e.message });
        return { error: e.message };
    }
}

async function run() {
    console.log("🚀 STARTING E2E SCENE RUNNER...");

    // 1. RG DUBAI BOOKING
    console.log("\n--- SCENE 1: RATEGAIN DUBAI ---");
    const rgSearch = await call("http://localhost:5012/", "POST", {
        destinationCode: "DXB", checkin: "2026-09-10", checkout: "2026-09-12",
        rooms: [{ adults: 2, children: 1, childAges: [5] }], countryCode: "IN"
    });
    
    const rgHotel = rgSearch.results?.find(h => h.source === "RG");
    let rgConf;
    if (rgHotel) {
        console.log(`Found RG Hotel: ${rgHotel.name}`);
        const rgPrecheck = await call("http://localhost:5013/precheck", "POST", {
            BookReservation: {
                propertyID: rgHotel.hotelId.replace("RG:", ""),
                PropertyCode: rgHotel.propertyCode,
                destinationCode: "DXB",
                checkin: "2026-09-10", checkout: "2026-09-12",
                RoomSelection: [{ NumberOfRooms: 1, NumberOfAdults: 2, NumberOfChild: 1, RoomType: "STD", RatePlanCode: "BASE" }]
            }
        });
        const rgCommit = await call("http://localhost:5013/commit", "POST", {
            BookReservation: {
                PropertyCode: rgHotel.propertyCode,
                BrandCode: rgHotel.brandCode || "N/A",
                destinationCode: "DXB",
                checkin: "2026-09-10", checkout: "2026-09-12",
                RoomSelection: [{ NumberOfRooms: 1, NumberOfAdults: 2, NumberOfChild: 1, RoomType: "STD", RatePlanCode: "BASE" }]
            }
        });
        rgConf = rgCommit?.body?.confirmationNumber || rgCommit?.confirmationNumber;
    } else {
        console.warn("⚠️ No RG Hotel found in Dubai Sandbox. Simulating RG Flow...");
        rgConf = "SIM-RG-12345";
    }

    // 2. TJ MONACO BOOKING
    console.log("\n--- SCENE 2: TRIPJACK MONACO ---");
    const tjSearch = await call("http://localhost:5012/", "POST", {
        destination: "Monaco", checkin: "2026-09-10", checkout: "2026-09-12",
        rooms: [{ adults: 2, children: 1, childAges: [5] }], countryCode: "IN"
    });
    let tjHotel = tjSearch.results?.find(h => h.source === "TJ");
    if (!tjHotel) {
        tjHotel = { hotelId: "TJ:1001", name: "Cannes Palace (Fallback for Monaco)", source: "TJ" };
    }
    
    const tjReview = await call("http://localhost:5013/precheck", "POST", {
        hid: tjHotel.hotelId.replace("TJ:", ""),
        optionId: "test-opt-123",
        reviewHash: "test-hash-456",
        correlationId: "test-corr-789",
        source: "TJ"
    });
    
    const tjBook = await call("http://localhost:5013/commit", "POST", {
        bookingId: tjReview.bookingId || "MOCK-TJ-PRE-ID",
        roomTravellerInfo: [{ travellerInfo: [{ fN: "Test", lN: "User", ti: "Mr", pt: "ADULT" }] }],
        deliveryInfo: { emails: ["test@klar.com"], contacts: ["9876543210"], code: ["+91"] }
    });

    // 3. MODIFY RG TO OCT
    if (rgConf) {
        console.log("\n--- SCENE 3: MODIFY RG TO OCT ---");
        await call("http://localhost:5013/amend/commit", "POST", {
            confirmationNumber: rgConf, checkIn: "2026-10-10", checkOut: "2026-10-12"
        });
    }

    // 4. CANCEL RG
    if (rgConf) {
        console.log("\n--- SCENE 4: CANCEL RG ---");
        await call("http://localhost:5013/cancel", "POST", { ConfirmationNumber: rgConf });
    }

    // 5. CAB SCENES
    console.log("\n--- SCENE 5: CABS (8084 PORT) ---");
    const cabScenesData = [
        { type: "airport_transfer", s: "Delhi Airport", d: "Delhi Hotel" },
        { type: "outstation", s: "Delhi", d: "Agra" },
        { type: "local", s: "Bangalore", d: "Bangalore Local" }
    ];

    for (const sc of cabScenesData) {
        const qRes = await call("http://localhost:8084/search/quotes", "POST", {
            pickupDate: "2026-09-15 10:00",
            origin: { type: "location", displayAddress: sc.s, lat: "28.5", long: "77.1", address: { city: "Delhi", country: "India" } },
            destination: { type: "location", displayAddress: sc.d, lat: "28.6", long: "77.2", address: { city: sc.d, country: "India" } },
            journeyType: sc.type, tripType: "oneway", passengers: 2
        });
        
        const bRes = await call("http://localhost:8084/booking/create", "POST", {
            bookingId: "MOCK-CAB-" + sc.type, provider: "tripjack", type: sc.type, status: "SUCCESS"
        });

        if (bRes.bookingId) {
            await call("http://localhost:8084/amendment/cancel", "POST", {
                bookingId: bRes.bookingId, reason: "Test Cancellation"
            });
        }
    }

    console.log("\n--- SAVING RESULTS ---");
    fs.writeFileSync("e2e-payload-comparison.json", JSON.stringify(log, null, 2));
    console.log("✅ Results saved to e2e-payload-comparison.json");
}

run().catch(err => {
    console.error("❌ E2E Runner Failed:", err);
});
