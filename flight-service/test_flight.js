const axios = require('axios');

async function test() {
  try {
    const searchPayload = {
        "cabinClass": "ECONOMY",
        "paxInfo": { "ADULT": 1, "CHILD": 0, "INFANT": 0 },
        "routeInfos": [
            {
                "fromCityOrAirport": { "code": "BOM" },
                "toCityOrAirport": { "code": "DEL" },
                "travelDate": "2026-08-25"
            }
        ],
        "searchModifiers": { "isDirectFlight": true, "isConnectFlight": false }
    };
    console.log("Searching flights...");
    const searchRes = await axios.post('http://localhost:5011/api/flight/search/oneway', searchPayload);
    const data = searchRes.data;
    console.log("Response keys:", Object.keys(data));
    if (!data.data || !data.data.flights) {
        console.log("No flights key. Full response:", JSON.stringify(data).substring(0, 500));
        return;
    }
    const flights = data.data.flights;
    console.log(`Found ${flights.length} flights`);
    if (flights.length === 0) return;
    
    // Get the first flight's priceId from review
    const firstFlight = flights[0];
    console.log("First flight:", firstFlight.airline, firstFlight.flightNumber);
    // The priceId is the fareId from the fare details
    // We need to look at what the flutter app sends for review
    // The flutter FlightCard must pass a priceId
    console.log("First flight keys:", Object.keys(firstFlight));
    
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}
test();
