const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:8084/search/quotes', {
      journeyType: "airport_transfer",
      tripType: "oneway",
      pickupDate: "2026-06-23 10:00",
      origin: {
        lat: 28.5562,
        long: 77.0878
      },
      destination: {
        lat: 28.6431,
        long: 77.2223
      },
      passengers: 1,
      bags: 2,
      from: "Indira Gandhi International Airport (DEL), Delhi",
      to: "New Delhi Railway Station, Bhavbhuti Marg, Delhi"
    });
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.log("Error Status:", err.response.status);
      console.log("Error Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}
test();
