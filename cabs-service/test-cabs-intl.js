const axios = require('axios');

async function testFormat() {
  try {
    const res = await axios.post('http://localhost:8084/search/quotes', {
      journeyType: "airport_transfer",
      tripType: "oneway",
      pickupDate: "2026-06-25 10:00",
      origin: {
        lat: 51.4700,
        long: -0.4543
      },
      destination: {
        lat: 51.4975,
        long: -0.1353
      },
      from: "Heathrow Airport (LHR), London, UK",
      to: "Westminster, London, UK",
      passengers: 1,
      bags: 2
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
            currency: firstQuote?.fareBreakup?.currency || "INR" // Checking if it returns GBP
        });
      }
    } else {
      console.log("Quotes Data:", JSON.stringify(res.data, null, 2));
    }
  } catch(err) {
      console.error(err.response?.data || err.message);
  }
}
testFormat();
