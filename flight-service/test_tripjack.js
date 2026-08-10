const axios = require('axios');
const payload = {
  "searchQuery": {
    "cabinClass": "ECONOMY",
    "paxInfo": { "ADULT": 1, "CHILD": 0, "INFANT": 0 },
    "routeInfos": [
      { "fromCityOrAirport": { "code": "HYD" }, "toCityOrAirport": { "code": "GOI" }, "travelDate": "2026-08-25" }
    ],
    "searchModifiers": { "isDirectFlight": true, "isConnectingFlight": true },
    "searchType": "ONEWAY"
  }
};
axios.post('http://192.168.0.23:5010/flight/search/oneway', payload, { headers: { 'Content-Type': 'application/json' } })
  .then(res => {
     console.log(JSON.stringify(res.data.data.flights.map(f => f.flightKey), null, 2));
  })
  .catch(err => console.error(err.message));
