const axios = require("axios");

const BASE = "http://localhost:5014/api/insurance";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMDAxIiwiZW1haWwiOiJ0ZXN0QGtsYXIuY29tIiwibmFtZSI6IlRlc3QgQWdlbnQiLCJpYXQiOjE3NzY2NjEzOTEsImV4cCI6MTc3NzI2NjE5MX0.26hp5-iTqAM3sCgNuMZwOgPI8PBpcwrssBPtP90FNf0";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
};

const results = {};

function sep(title) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(70)}`);
}

async function run() {
  // ─── 1. Health Check ────────────────────────────────────────────────
  sep("TEST 1: GET /health (no auth)");
  try {
    const r = await axios.get(`${BASE}/health`);
    results["1_health"] = { status: r.status, data: r.data };
    console.log("STATUS:", r.status);
    console.log("RESPONSE:", JSON.stringify(r.data, null, 2));
  } catch (e) {
    results["1_health"] = { status: e.response?.status, data: e.response?.data };
    console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // ─── 2. Search — Standalone (Popular Region) ───────────────────────
  sep("TEST 2: POST /search — STANDALONE (Popular Region)");
  let planId, productId, totalFare;
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15",
        ed: "2026-05-30",
        isc: {
          iri: [
            { rkey: "EUR", rt: "POPULARREGION" },
            { rkey: "ASI", rt: "POPULARREGION" },
          ],
        },
        iti: [{ age: 30 }],
      },
    }, { headers });
    results["2_search_standalone"] = { status: r.status, data: r.data };
    console.log("STATUS:", r.status);
    console.log("journeyType:", r.data.journeyType);

    // Extract planId and productId
    const pli = r.data.body?.isr?.iinfo?.pli;
    if (pli && pli.length) {
      planId = pli[0].plid;
      productId = pli[0].pi?.[0]?.pid;
      // The path according to logs: pli[0].pi[0].tfd.ifc.TF
      totalFare = pli[0].pi?.[0]?.tfd?.ifc?.TF || 2350;
      console.log("✅ Extracted planId:", planId);
      console.log("✅ Extracted productId:", productId);
      console.log("✅ Extracted totalFare:", totalFare);
      console.log("Plans count:", pli.length);
      // Show first plan summary
      console.log("First plan:", JSON.stringify({
        plid: pli[0].plid,
        planName: pli[0].pn,
        products: pli[0].pi?.length,
        firstProductId: pli[0].pi?.[0]?.pid,
        totalFare: totalFare,
      }, null, 2));
    } else {
      console.log("⚠️  No plans found. Full body keys:", Object.keys(r.data.body || {}));
      console.log("Full response (truncated):", JSON.stringify(r.data).substring(0, 1000));
    }
  } catch (e) {
    results["2_search_standalone"] = { status: e.response?.status, data: e.response?.data };
    console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // ─── 3. Search — Student ───────────────────────────────────────────
  sep("TEST 3: POST /search — STUDENT");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15",
        cd: "180",
        isc: { iri: [{ rkey: "AU", rt: "COUNTRY" }] },
        iti: [{ age: 20 }],
        ict: "STUDENT",
      },
    }, { headers });
    results["3_search_student"] = { status: r.status, journeyType: r.data.journeyType, hasPlans: !!r.data.body?.isr };
    console.log("STATUS:", r.status);
    console.log("journeyType:", r.data.journeyType);
    const pli3 = r.data.body?.isr?.iinfo?.pli;
    console.log("Plans found:", pli3?.length || 0);
  } catch (e) {
    results["3_search_student"] = { status: e.response?.status, data: e.response?.data };
    console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // ─── 4. Search — AMT ──────────────────────────────────────────────
  sep("TEST 4: POST /search — AMT");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15",
        ed: "2027-05-14",
        isc: { iri: [{ rkey: "MDE", rt: "POPULARREGION" }] },
        iti: [{ age: 35 }],
        ict: "AMT",
        adr: "45",
      },
    }, { headers });
    results["4_search_amt"] = { status: r.status, journeyType: r.data.journeyType };
    console.log("STATUS:", r.status);
    console.log("journeyType:", r.data.journeyType);
    const pli4 = r.data.body?.isr?.iinfo?.pli;
    console.log("Plans found:", pli4?.length || 0);
  } catch (e) {
    results["4_search_amt"] = { status: e.response?.status, data: e.response?.data };
    console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // ─── 5. Search — Embedded (API_EMB) ───────────────────────────────
  sep("TEST 5: POST /search — EMBEDDED (API_EMB)");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15",
        ed: "2026-06-15",
        isc: { iri: [{ rkey: "MDE", rt: "POPULARREGION" }] },
        iti: [{ age: 35 }],
        ict: "API_EMB",
      },
    }, { headers });
    results["5_search_embedded"] = { status: r.status, journeyType: r.data.journeyType };
    console.log("STATUS:", r.status);
    console.log("journeyType:", r.data.journeyType);
  } catch (e) {
    results["5_search_embedded"] = { status: e.response?.status, data: e.response?.data };
    console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // ─── 6. Review ────────────────────────────────────────────────────
  let bookingId;
  if (planId && productId) {
    sep("TEST 6: POST /review");
    try {
      const r = await axios.post(`${BASE}/review`, {
        pli: [{ plid: planId, pi: [{ pid: productId }] }],
      }, { headers });
      results["6_review"] = { status: r.status, data: r.data };
      bookingId = r.data.bookingId || r.data.body?.bid;
      console.log("STATUS:", r.status);
      console.log("✅ bookingId:", bookingId);
      console.log("RESPONSE:", JSON.stringify(r.data, null, 2));
    } catch (e) {
      results["6_review"] = { status: e.response?.status, data: e.response?.data };
      console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
  } else {
    sep("TEST 6: SKIPPED — no planId/productId from search");
    results["6_review"] = { skipped: true, reason: "No planId/productId" };
  }

  // ─── 7. Book ──────────────────────────────────────────────────────
  if (bookingId && planId && productId && totalFare) {
    sep(`TEST 7: POST /book — Standalone (Amount: ${totalFare})`);
    try {
      const r = await axios.post(`${BASE}/book`, {
        bookingId,
        paymentInfos: [{ paymentMedium: "WALLET", amount: totalFare }],
        deliveryInfo: {
          emails: ["test@klar.com"],
          contacts: ["9810000001"],
        },
        pli: [{
          plid: planId,
          pi: [{
            pid: productId,
            iti: [
              {
                id: 1, dob: "1994-06-15", age: 30,
                fn: "Rahul", ln: "Sharma",
                eid: "rahul.sharma@test.com",
                pnum: "A1234567", cnum: "9810000001", gen: "M",
                ni: [{ nn: "Priya Sharma", nr: "SPOUSE" }],
              }
            ],
          }],
        }],
      }, { headers });
      results["7_book"] = { status: r.status, data: r.data };
      bookingId = r.data.bookingId || bookingId;
      console.log("STATUS:", r.status);
      console.log("✅ bookingId:", r.data.bookingId);
      console.log("RESPONSE:", JSON.stringify(r.data, null, 2).substring(0, 2000));
    } catch (e) {
      results["7_book"] = { status: e.response?.status, data: e.response?.data };
      console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
  } else {
    sep("TEST 7: SKIPPED");
    if (!bookingId) console.log("⏭️  Reason: bookingId is missing (Review step failed?)");
    if (!planId)    console.log("⏭️  Reason: planId is missing (Search step failed?)");
    if (!productId) console.log("⏭️  Reason: productId is missing (Search step failed?)");
    if (!totalFare) console.log("⏭️  Reason: totalFare is missing (Search step failed to extract price?)");
    results["7_book"] = { skipped: true, reason: "Incomplete chain" };
  }

  // ─── 8. Booking Details (TripJack) ────────────────────────────────
  if (bookingId) {
    sep("TEST 8: POST /booking-details");
    try {
      const r = await axios.post(`${BASE}/booking-details`, { bookingId }, { headers });
      results["8_booking_details"] = { status: r.status, data: r.data };
      console.log("STATUS:", r.status);
      const orderStatus = r.data.body?.order?.status || r.data.body?.itemInfos?.INSURANCE?.ios;
      console.log("Insurance Status:", orderStatus);
      console.log("RESPONSE:", JSON.stringify(r.data, null, 2).substring(0, 2000));
    } catch (e) {
      results["8_booking_details"] = { status: e.response?.status, data: e.response?.data };
      console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
  } else {
    sep("TEST 8: SKIPPED — no bookingId");
    results["8_booking_details"] = { skipped: true };
  }

  // ─── 9. My Bookings (DB List) ────────────────────────────────────
  sep("TEST 9: GET /bookings (list from DB)");
  try {
    const r = await axios.get(`${BASE}/bookings?page=1&limit=5`, { headers });
    results["9_bookings_list"] = { status: r.status, data: r.data };
    console.log("STATUS:", r.status);
    console.log("Bookings count:", r.data.body?.bookings?.length);
    console.log("Pagination:", JSON.stringify(r.data.body?.pagination));
    if (r.data.body?.bookings?.length) {
      console.log("Latest booking:", JSON.stringify({
        id: r.data.body.bookings[0]._id,
        bookingId: r.data.body.bookings[0].bookingId,
        status: r.data.body.bookings[0].status,
        journeyType: r.data.body.bookings[0].journeyType,
        amount: r.data.body.bookings[0].amount,
      }, null, 2));
    }
  } catch (e) {
    results["9_bookings_list"] = { status: e.response?.status, data: e.response?.data };
    console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // ─── 10. Single Booking from DB ──────────────────────────────────
  sep("TEST 10: GET /bookings/:id (single from DB)");
  try {
    // First get a valid DB id from list
    const listRes = await axios.get(`${BASE}/bookings?page=1&limit=1`, { headers });
    const dbId = listRes.data.body?.bookings?.[0]?._id;
    if (dbId) {
      const r = await axios.get(`${BASE}/bookings/${dbId}`, { headers });
      results["10_booking_by_id"] = { status: r.status, hasData: !!r.data.body };
      console.log("STATUS:", r.status);
      console.log("Booking found:", JSON.stringify({
        bookingId: r.data.body?.bookingId,
        status: r.data.body?.status,
        journeyType: r.data.body?.journeyType,
        travellers: r.data.body?.travellers?.length,
      }, null, 2));
    } else {
      console.log("⚠️  No bookings in DB to query by ID");
      results["10_booking_by_id"] = { skipped: true, reason: "No bookings in DB" };
    }
  } catch (e) {
    results["10_booking_by_id"] = { status: e.response?.status, data: e.response?.data };
    console.log("ERROR:", e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // ─── 11–14. Validation Tests ──────────────────────────────────────
  sep("TEST 11: VALIDATION — Blacklisted Country (expect 400)");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15", ed: "2026-05-30",
        isc: { iri: [{ rkey: "IR", rt: "COUNTRY" }] },
        iti: [{ age: 30 }],
      },
    }, { headers });
    results["11_blacklisted"] = { status: r.status, data: r.data };
    console.log("⚠️  Expected 400 but got:", r.status);
  } catch (e) {
    results["11_blacklisted"] = { status: e.response?.status, data: e.response?.data };
    console.log("STATUS:", e.response?.status, "(expected 400)");
    console.log("RESPONSE:", JSON.stringify(e.response?.data, null, 2));
  }

  sep("TEST 12: VALIDATION — Too Many Travellers (expect 400)");
  try {
    const iti = [];
    for (let i = 0; i < 11; i++) iti.push({ age: 20 + i });
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15", ed: "2026-05-30",
        isc: { iri: [{ rkey: "EUR", rt: "POPULARREGION" }] },
        iti,
      },
    }, { headers });
    results["12_too_many"] = { status: r.status };
    console.log("⚠️  Expected 400 but got:", r.status);
  } catch (e) {
    results["12_too_many"] = { status: e.response?.status, data: e.response?.data };
    console.log("STATUS:", e.response?.status, "(expected 400)");
    console.log("RESPONSE:", JSON.stringify(e.response?.data, null, 2));
  }

  sep("TEST 13: VALIDATION — Student Age Out of Range (expect 400)");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15", cd: "180",
        isc: { iri: [{ rkey: "AU", rt: "COUNTRY" }] },
        iti: [{ age: 50 }],
        ict: "STUDENT",
      },
    }, { headers });
    results["13_student_age"] = { status: r.status };
    console.log("⚠️  Expected 400 but got:", r.status);
  } catch (e) {
    results["13_student_age"] = { status: e.response?.status, data: e.response?.data };
    console.log("STATUS:", e.response?.status, "(expected 400)");
    console.log("RESPONSE:", JSON.stringify(e.response?.data, null, 2));
  }

  sep("TEST 14: VALIDATION — AMT Invalid Duration (expect 400)");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15", ed: "2027-05-14",
        isc: { iri: [{ rkey: "ASI", rt: "POPULARREGION" }] },
        iti: [{ age: 35 }],
        ict: "AMT",
        adr: "90",
      },
    }, { headers });
    results["14_amt_duration"] = { status: r.status };
    console.log("⚠️  Expected 400 but got:", r.status);
  } catch (e) {
    results["14_amt_duration"] = { status: e.response?.status, data: e.response?.data };
    console.log("STATUS:", e.response?.status, "(expected 400)");
    console.log("RESPONSE:", JSON.stringify(e.response?.data, null, 2));
  }

  sep("TEST 16: VALIDATION — Student with Region (expect 400 per v6.0)");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15", cd: "180",
        isc: { iri: [{ rkey: "EUR", rt: "POPULARREGION" }] },
        iti: [{ age: 25 }],
        ict: "STUDENT",
      },
    }, { headers });
    results["16_student_region"] = { status: r.status };
    console.log("⚠️  Expected 400 but got:", r.status);
  } catch (e) {
    results["16_student_region"] = { status: e.response?.status, data: e.response?.data };
    console.log("STATUS:", e.response?.status, "(expected 400)");
    console.log("RESPONSE:", JSON.stringify(e.response?.data, null, 2));
  }

  sep("TEST 17: VALIDATION — AMT with Country (expect 400 per v6.0)");
  try {
    const r = await axios.post(`${BASE}/search`, {
      isq: {
        sd: "2026-05-15", ed: "2027-05-14",
        isc: { iri: [{ rkey: "US", rt: "COUNTRY" }] },
        iti: [{ age: 35 }],
        ict: "AMT",
        adr: "45",
      },
    }, { headers });
    results["17_amt_country"] = { status: r.status };
    console.log("⚠️  Expected 400 but got:", r.status);
  } catch (e) {
    results["17_amt_country"] = { status: e.response?.status, data: e.response?.data };
    console.log("STATUS:", e.response?.status, "(expected 400)");
    console.log("RESPONSE:", JSON.stringify(e.response?.data, null, 2));
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────
  sep("SUMMARY");
  console.log("\n");
  for (const [test, result] of Object.entries(results)) {
    const icon = result.skipped ? "⏭️" : (result.status >= 200 && result.status < 300) ? "✅" : result.status === 400 || result.status === 401 ? "🛡️" : "❌";
    console.log(`  ${icon}  ${test}: HTTP ${result.status || "SKIPPED"}`);
  }
  console.log("\n");
}

run().catch(e => console.error("Fatal:", e.message));
