const axios = require('axios');

async function testFormat() {
  try {
    const res = await axios.post('http://localhost:8084/search/quotes', {
      journeyType: "airport_transfer",
      tripType: "oneway",
      pickupDate: "2026-06-25 10:00",
      origin: {
        type: "location",
        lat: "28.5562",
        long: "77.0878",
        displayAddress: "Indira Gandhi International Airport (DEL), Delhi",
        address: { city: "", country: "" }
      },
      destination: {
        type: "location",
        lat: "28.6431",
        long: "77.2223",
        displayAddress: "New Delhi Railway Station, Bhavbhuti Marg, Delhi",
        address: {}
      },
      passengers: 1,
      bags: 2
    });
    console.log("Status:", res.status);
    console.log("Quotes count:", res.data?.data?.quotesInfo?.length);
  } catch(err) {
      console.error(err.response?.data || err.message);
  }
}
testFormat();
