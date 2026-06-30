import axios from "axios";
import { env } from "./config/env";
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1"]);

async function testUrlAndHeaders(baseUrl: string, headers: any) {
  console.log(
    `Testing ${baseUrl}/hms/v3/hotel/listing with ${Object.keys(headers)}`,
  );
  try {
    const res = await axios.post(
      `${baseUrl}/hms/v3/hotel/listing`,
      {
        checkIn: "2026-05-10",
        checkOut: "2026-05-12",
        rooms: [{ adults: 2 }],
        currency: "INR",
        nationality: "106",
        hids: ["1000000"],
        correlationId: "test-correlation-id",
      },
      {
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        timeout: 10000,
      },
    );

    console.log(`Status: ${res.status}, success: ${res.data.status?.success}`);
    if (res.data.status?.success === false) {
      console.log("Response Errors:", JSON.stringify(res.data.errors, null, 2));
    }
    return res.data.status?.success;
  } catch (e: any) {
    console.log(`HTTP Error: ${e.response?.status}`);
    return false;
  }
}

async function runTests() {
  const key = env.tripJack.apiKey;
  const agency = env.tripJack.agencyId;
  const urls = [
    "https://apitest-hms.tripjack.com",
    "https://apitest.tripjack.com",
  ];

  const headerScenarios = [{ apikey: key }, { apikey: key, agencyId: agency }];

  for (const url of urls) {
    for (const headers of headerScenarios) {
      await testUrlAndHeaders(url, headers);
    }
  }
}

runTests();
