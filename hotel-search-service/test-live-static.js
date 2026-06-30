const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

async function test() {
  try {
    const apiKey = process.env.TRIPJACK_API_KEY;
    const agencyId = process.env.TRIPJACK_AGENCY_ID;
    const baseUrl = process.env.TRIPJACK_BASE_URL
      ? process.env.TRIPJACK_BASE_URL.trim()
      : "https://hms-search.tripjack.com";

    console.log(`Base URL: ${baseUrl}`);
    console.log(`API Key: ${apiKey}`);
    console.log(`Agency ID: ${agencyId}`);

    const client = axios.create({
      baseURL: baseUrl,
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: apiKey,
        agencyId: agencyId,
      },
    });

    // Let's call hotel static-detail for a real hotel ID.
    // B&B HOTEL Rosny-sous-Bois Paris Est is TJ:100000000058 (as seen in test-static.js or other logs)
    const res = await client.post("/hms/v3/hotel/static-detail", {
      hid: "100000000058",
    });

    const data = res.data;
    console.log("Root keys:", Object.keys(data));
    if (data.hotel) {
      console.log("data.hotel keys:", Object.keys(data.hotel));
      console.log("data.hotel.amenities:", data.hotel.amenities);
    }
    if (data.hotelInfo) {
      console.log("data.hotelInfo keys:", Object.keys(data.hotelInfo));
      console.log("data.hotelInfo.amenities:", data.hotelInfo.amenities);
    }
    if (data.amenities) {
      console.log("data.amenities:", data.amenities);
    }
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}
test();
