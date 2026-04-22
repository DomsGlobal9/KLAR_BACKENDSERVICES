const axios = require('axios');

async function testFullPayload() {
  try {
    const res = await axios.post('http://localhost:8084/search/quotes', {
      journeyType: "airport_transfer",
      tripType: "oneway",
      pickupDate: "2026-06-25 10:00", // A future date
      origin: {
        type: "location",
        lat: "28.5562",
        long: "77.0878",
        displayAddress: "Indira Gandhi International Airport (DEL), Delhi",
        address: { city: "Delhi", country: "India" }
      },
      destination: {
        type: "location",
        lat: "28.6431",
        long: "77.2223",
        displayAddress: "New Delhi Railway Station, Bhavbhuti Marg, Delhi",
        address: { city: "Delhi", country: "India" }
      },
      passengers: 1,
      bags: 2
    });
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error("Error Status:", err.response.status);
      console.error("Error Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}
testFullPayload();
