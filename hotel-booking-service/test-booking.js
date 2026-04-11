const jwt = require("jsonwebtoken");
const fs = require("fs");

let logData = {};

function log(key, val) {
    if(!logData[key]) logData[key] = [];
    logData[key].push(val);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log("Generating JWT token...");
    const token = jwt.sign(
        { id: "test-user", role: "user", email: "test@domain.com" },
        "your_super_secret_jwt_key_change_me_in_production",
        { expiresIn: "10m" }
    );

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    console.log("\n=== 1. SEARCHING HOTELS IN DUBAI ===");
    const searchBody = {
        destination: "Dubai",
        checkin: "2026-04-03",
        checkout: "2026-04-04",
        rooms: [ { adults: 1, children: 0, childAges: [] } ],
        countryCode: "IN"
    };

    let searchRes;
    try {
        const response = await fetch("http://localhost:5012/", {
            method: "POST", headers, body: JSON.stringify(searchBody)
        });
        searchRes = await response.json();
    } catch (e) {
        console.error("Search failed:", e.message);
        return;
    }

    if (!searchRes?.results || searchRes.results.length === 0) {
        console.error("No hotels found in search response!");
        console.log("Full search response: ", JSON.stringify(searchRes, null, 2));
        return;
    }
    
    log("SEARCH", `Found ${searchRes.results.length} hotels. Meta: ${JSON.stringify(searchRes.meta)}`);

    const hotels = searchRes.results;
    const tjHotel = hotels.find(h => h.hotelId.startsWith("TJ:"));
    const rgHotel = hotels.find(h => !h.hotelId.startsWith("TJ:"));

    if (tjHotel) log("SEARCH", `Found TripJack Hotel: ${tjHotel.hotelId} ${tjHotel.name}`);
    if (rgHotel) log("SEARCH", `Found RateGain Hotel: ${rgHotel.hotelId} ${rgHotel.name}`);

    if (tjHotel) await testTripJackFlow(tjHotel, searchBody, headers);
    if (rgHotel) await testRateGainFlow(rgHotel, searchBody, headers);

    fs.writeFileSync("test-booking-results.json", JSON.stringify(logData, null, 2));
}

async function testTripJackFlow(hotel, searchBody, headers) {
    console.log(`\n=== TRIPJACK FLOW FOR ${hotel.hotelId} ===`);
    
    console.log("--> Fetching Products...");
    const productsRes = await fetch(`http://localhost:5012/hotels/${encodeURIComponent(hotel.hotelId)}/products`, {
        method: "POST", headers, body: JSON.stringify(searchBody)
    }).then(r => r.json());

    if (!productsRes?.body?.options || productsRes.body.options.length === 0) {
        console.error("No products found for TJ hotel. Error:", productsRes.description, JSON.stringify(productsRes));
        return;
    }
    log("TJ_PRODUCTS", { topKeys: Object.keys(productsRes.body), hid: productsRes.body.hid, hotelId: productsRes.body.hotelId });

    const room = productsRes.body.options[0];
    console.log(`Got ${productsRes.body.options.length} options. Using optionId: ${room.optionId}`);

    console.log("--> Precheck (Review)...");
    const precheckPayload = {
        propertyId: hotel.hotelId,
        hid: hotel.hotelId.replace("TJ:", ""),
        optionId: room.optionId,
        reviewHash: productsRes.body.reviewHash || room.reviewHash || room.bookingCode, 
        correlationId: room.correlationId || productsRes.body.correlationId || "test-tj-" + Date.now()
    };

    let precheckData;
    try {
        precheckData = await fetch(`http://localhost:5013/precheck`, {
            method: "POST", headers, body: JSON.stringify(precheckPayload)
        }).then(r => r.json()).catch(e => ({ status: false, description: e.message }));
        log("TJ_PRECHECK_RES", precheckData);
    } catch (e) {
        log("TJ_PRECHECK_ERR", JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return;
    }

    if (!precheckData.status || !precheckData.bookingId) {
        log("TJ_PRECHECK_FAIL", precheckData);
        return;
    }

    log("TJ_COMMIT", "Committing...");
    const commitPayload = {
        propertyId: hotel.hotelId,
        bookingId: precheckData.bookingId,
        roomTravellerInfo: [
            {
                travellerInfo: [
                    {
                        fN: "Test", lN: "User", ti: "Mr", pt: "ADULT"
                    }
                ]
            }
        ],
        deliveryInfo: {
            emails: ["test@domain.com"],
            contacts: ["9999999999"],
            code: ["+91"]
        }
    };

    try {
        const commitData = await fetch(`http://localhost:5013/commit`, {
            method: "POST", headers, body: JSON.stringify(commitPayload)
        }).then(r => r.json());
        console.log("Commit Status:", commitData.statusCode, commitData.description);
        console.log("Booking ID:", commitData.bookingId);
    } catch (e) {
        console.error("Commit failed:", e.message);
    }
}

async function testRateGainFlow(hotel, searchBody, headers) {
    console.log(`\n=== RATEGAIN FLOW FOR ${hotel.hotelId} ===`);

    const raw = hotel.rawPayload || {};
    console.log("RG Raw keys:", Object.keys(raw));
    console.log("RG Raw propertyCode:", raw.propertyCode, "PropertyCode:", raw.PropertyCode, "BrandCode:", raw.brandCode, "propertyId:", raw.propertyId);

    const rgProductPayload = {
        ...searchBody,
        propertyID: raw.propertyId || hotel.hotelId.replace("RG:", ""),
        PropertyCode: raw.propertyCode || raw.PropertyCode || raw.propertyId,
        BrandCode: raw.brandCode || raw.BrandCode || "N/A", // We need to find out what it uses
        destinationCode: raw.destinationCode || raw.DestCode || "DXB" // Usually frontends extract this
    };

    console.log(`[RateGain] Requesting Products with PropertyCode: ${rgProductPayload.PropertyCode}, BrandCode: ${rgProductPayload.BrandCode}, DestCode: ${rgProductPayload.destinationCode}`);

    console.log("--> Fetching Products...");
    const productsRes = await fetch(`http://localhost:5012/hotels/${encodeURIComponent(hotel.hotelId)}/products`, {
        method: "POST", headers, body: JSON.stringify(rgProductPayload)
    }).then(r => r.json()).catch(e => ({ status: false, description: e.message }));

    if (!productsRes?.Products || productsRes.Products.length === 0) {
        log("RG_PRODUCTS_FAIL", productsRes);
        if (productsRes?.status === false) {
             console.error("No products found for RG hotel. Error:", productsRes.description, JSON.stringify(productsRes));
             return;
        }
    } else {
        log("RG_PRODUCTS", `Success - Got ${productsRes.Products.length} products`);
    }

    const room = productsRes?.body?.Rooms?.[0] || productsRes?.Products?.[0] || {};
    console.log(`Got products.`);

    const reqBody = {
        BookReservation: {
            propertyID: hotel.hotelId.replace("RG:", ""),
            PropertyCode: raw.propertyCode || raw.PropertyCode || raw.propertyId,
            BrandCode: raw.brandCode || raw.BrandCode,
            destinationCode: raw.destinationCode || "DXB",
            checkin: searchBody.checkin,
            checkout: searchBody.checkout,
            RoomSelection: [
                {
                    NumberOfRooms: 1,
                    NumberOfAdults: 1,
                    NumberOfChild: 0,
                    RoomType: room.roomCode || room.RoomTypeCode,
                    RatePlanCode: room.rate?.[0]?.rateKey || room.ratePlanCode || room.RatePlanCode
                }
            ]
        }
    };

    log("RG_PRECHECK", "--> Precheck...");
    let precheckData;
    try {
        precheckData = await fetch(`http://localhost:5013/precheck`, {
            method: "POST", headers, body: JSON.stringify(reqBody)
        }).then(r => r.json());
        log("RG_PRECHECK_RES", precheckData);
    } catch(e) {
        log("RG_PRECHECK_FAIL", e.message);
    }

    log("RG_COMMIT", "--> Commit...");
    try {
        const commitData = await fetch(`http://localhost:5013/commit`, {
            method: "POST", headers, body: JSON.stringify(reqBody)
        }).then(r => r.json());
        log("RG_COMMIT_RES", commitData);
    } catch(e) {
        log("RG_COMMIT_FAIL", e.message);
    }
}

runTest();
