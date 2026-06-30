import axios from "axios";
import { env } from "./config/env";

async function testUrls() {
  const bookingId = "TJS20990000003651";

  const urls = [
    "https://apitest-hotel-booker.tripjack.com",
    "https://apitest-oms.tripjack.com",
    "https://apitest.tripjack.com",
  ];

  for (const url of urls) {
    console.log(`\nTesting URL: ${url}`);
    const testClient = axios.create({
      baseURL: url,
      timeout: 5000, // 5s timeout
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: env.tripJack.apiKey,
        agencyId: env.tripJack.agencyId,
      },
    });

    try {
      const start = Date.now();
      const res = await testClient.post(
        `/oms/v3/hotel/cancel-booking/${bookingId}`,
      );
      console.log(
        `Success! Status: ${res.status}, Time: ${Date.now() - start}ms`,
      );
      console.log("Response:", JSON.stringify(res.data));
    } catch (err: any) {
      console.log(`Failed! Time: ${err.delay || "N/A"}, Error: ${err.message}`);
      if (err.response) {
        console.log("Response Status:", err.response.status);
        console.log("Response Data:", JSON.stringify(err.response.data));
      }
    }
  }
}

testUrls().catch(console.error);
