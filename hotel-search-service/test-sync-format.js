const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

async function tryUrl(url) {
  try {
    console.log(`Trying URL: ${url}`);
    const apiKey = process.env.TRIPJACK_API_KEY;
    const agencyId = process.env.TRIPJACK_AGENCY_ID;

    const client = axios.create({
      baseURL: url,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: apiKey,
        agencyId: agencyId,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const res = await client.post("/hms/v3/fetch-static-hotels", {
      pageSize: 2,
    });

    console.log(`Success on ${url}!`);
    const data = res.data;
    const hotels = data.hotelOpInfos || data.hotels || [];
    console.log(`Found ${hotels.length} hotels.`);
    if (hotels.length > 0) {
      const sample = hotels[0];
      console.log("Hotel keys:", Object.keys(sample));
      if (sample.amenities) {
        console.log(
          "Found amenities on static sync payload:",
          sample.amenities,
        );
      } else {
        console.log("NO amenities on static sync payload.");
      }
    }
    return true;
  } catch (e) {
    console.error(
      `Failed on ${url}: Status: ${e.response?.status}, Msg: ${e.message}`,
    );
    return false;
  }
}

async function test() {
  // Try live and test endpoints
  const urls = [
    "https://hms-search.tripjack.com",
    "https://apitest.tripjack.com",
    "https://hms.tripjack.com",
    "https://apitest-hms.tripjack.com",
  ];
  for (const url of urls) {
    const ok = await tryUrl(url);
    if (ok) break;
  }
}
test();
