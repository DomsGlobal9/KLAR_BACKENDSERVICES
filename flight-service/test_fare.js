const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:5011/flight/search/oneway', {
      routeInfos: [
        {
          fromCityOrAirport: { code: "HYD" },
          toCityOrAirport: { code: "DEL" },
          travelDate: "2026-08-10"
        }
      ],
      paxInfo: { ADULT: 1, CHILD: 0, INFANT: 0 },
      searchModifiers: {
          isDirectFlight: false,
          isConnectingFlight: false
      },
      cabinClass: "ECONOMY"
    });
    const session = res.data.data.sessionId;
    const flightKey = res.data.data.flights[0].flightKey;
    console.log("Session:", session, "FlightKey:", flightKey);

    const fareRes = await axios.post('http://localhost:5011/flight/fare/oneway', {
      sessionId: session,
      flightKey: flightKey
    });
    console.log("Fare success!", fareRes.data.success);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
test();
