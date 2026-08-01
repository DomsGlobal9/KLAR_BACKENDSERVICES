const axios = require('axios');

async function checkSeats() {
  try {
    console.log("Searching for flights (DEL -> BOM)...");
    
    // Set a date for roughly 1-2 weeks in the future to ensure flights exist
    const date = new Date();
    date.setDate(date.getDate() + 14);
    const travelDate = date.toISOString().split('T')[0];
    
    const searchPayload = {
      searchQuery: {
        cabinClass: "ECONOMY",
        paxInfo: { ADULT: "1", CHILD: "0", INFANT: "0" },
        routeInfos: [{
          fromCityOrAirport: { code: "DEL" },
          toCityOrAirport: { code: "BOM" },
          travelDate: travelDate
        }],
        searchModifiers: {
          isDirectFlight: true,
          isConnectFlight: false
        }
      }
    };
    
    // Check search route
    const searchRes = await axios.post('http://localhost:5011/api/flight/search/oneway', searchPayload);
    
    // It's possible the structure is slightly different. We will try to parse it.
    let searchResult = searchRes.data.searchResult;
    
    if (!searchResult || !searchResult.tripInfos || !searchResult.tripInfos.ONWARD) {
      console.log("Search result structure not as expected:", Object.keys(searchRes.data));
      return;
    }
    
    const onwardFlights = searchResult.tripInfos.ONWARD;
    console.log(`Found ${onwardFlights.length} onward flights. Selecting first 10...`);
    
    const selectedFlights = onwardFlights.slice(0, 10);
    
    let flightResults = [];
    
    for (let i = 0; i < selectedFlights.length; i++) {
      const flight = selectedFlights[i];
      
      const flightCode = flight.sI[0].fD.aI.code + "-" + flight.sI[0].fD.fN;
      
      console.log(`\n--- Checking Flight ${i+1}: ${flightCode} ---`);
      
      // We need fare details first
      const farePayload = {
        sessionId: searchRes.data.sessionId || searchResult.sessionId || searchRes.data.searchResult.sessionId, // not sure where sessionId is mapped, usually at root or searchResult
        flightKey: flight.sI[0].id // wait, flightKey might be different. usually it's the entire sI array or a specific ID.
      };
      
      // Let's just output this script and run it step by step
    }
    
  } catch(e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}

checkSeats();
