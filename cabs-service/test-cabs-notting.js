const axios = require('axios');

async function testNottingHill() {
  try {
    const res = await axios.post('http://localhost:8084/search/quotes', {
      journeyType: "local", // local journey mode
      tripType: "oneway",
      pickupDate: "2026-06-25 10:00",
      origin: {
        lat: 51.5096,
        long: -0.2036
      },
      destination: {
        lat: 51.4975,
        long: -0.1353
      },
      from: "Notting Hill, London, UK",
      to: "Westminster, London, UK",
      passengers: 2,
      bags: 1
    });
    console.log("Status:", res.status);
    if(res.data?.data?.quotesInfo) {
      console.log(`Success! Found ${res.data.data.quotesInfo.length} vehicle categories.`);
      const firstCategory = res.data.data.quotesInfo[0];
      if (firstCategory) {
        console.log("First Category:", firstCategory.vehicleCategory, firstCategory.vehicleType);
        const firstQuote = firstCategory.quotes?.[0];
        console.log("Details:", {
            vendor: firstQuote?.vendorId,
            price: firstQuote?.fareBreakup?.totalFare,
            model: firstQuote?.model || firstCategory.similarType,
            currency: firstQuote?.fareBreakup?.currency || "GBP"
        });
      }
    } else {
      console.log("Quotes Data:", JSON.stringify(res.data, null, 2));
    }
  } catch(err) {
      console.error(err.response?.data || err.message);
  }
}
testNottingHill();
