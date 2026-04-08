// Test script for Unified Hotel Search Aggregator
import axios from "axios";

const SEARCH_URL = "http://localhost:5012/api/search";

async function testUnifiedSearch() {
  console.log("🚀 Initiating Unified Hotel Search Test...\n");

  const payload = {
    destination: "dubai", // This will resolve both to RG (T16FPL) and TJ (hids from cache)
    checkin: "2026-05-25",
    checkout: "2026-05-26",
    countryCode: "IN",
    currency: "INR",
    rooms: [
      {
        adults: 2,
        children: 0,
        childAges: []
      }
    ]
  };

  console.log("📦 Request Payload:");
  console.log(JSON.stringify(payload, null, 2));

  try {
    const startTime = Date.now();
    const response = await axios.post(SEARCH_URL, payload);
    const endTime = Date.now();

    console.log(`\n✅ Response Received in ${endTime - startTime}ms`);
    console.log("📊 Meta Information:");
    console.log(JSON.stringify(response.data.meta, null, 2));

    const results = response.data.results || [];
    console.log(`\n🏨 Total Deduplicated Hotels Found: ${results.length}`);
    
    if (results.length > 0) {
      console.log("\n🥇 Top 3 Cheapest Hotels:");
      results.slice(0, 3).forEach((h: any, i: number) => {
        console.log(`${i + 1}. [${h.source}] ${h.name} - ${h.price} ${h.currency}`);
      });
    }

  } catch (error: any) {
    console.error("\n❌ Request Failed!");
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testUnifiedSearch();
