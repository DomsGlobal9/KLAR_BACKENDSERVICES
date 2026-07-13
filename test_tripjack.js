const axios = require('axios');
async function test() {
  const url = "https://apitest.tripjack.com/fms/v1/air-search-all";
  const apikey = "8122396e95267a-1fc1-4cc1-9b19-f9c34f3b143a";
  const payload = {"searchQuery": {"routeInfos": [{"fromCityOrAirport": {"code": "HYD"}, "toCityOrAirport": {"code": "LHR"}, "travelDate": "2026-08-12"}, {"fromCityOrAirport": {"code": "LHR"}, "toCityOrAirport": {"code": "DXB"}, "travelDate": "2026-08-21"}], "paxInfo": {"ADULT": 1, "CHILD": 0, "INFANT": 0}, "cabinClass": "ECONOMY"}};
  try {
    const res = await axios.post(url, payload, { headers: { apikey, "Content-Type": "application/json" } });
    const combo = res.data.searchResult.tripInfos.COMBO[0];
    console.log(JSON.stringify(combo.sI, null, 2));
  } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
test();
