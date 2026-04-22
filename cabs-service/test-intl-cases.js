const axios = require('axios');

const cases = [
    {
        name: "London (Heathrow to Westminster)",
        payload: {
            journeyType: "airport_transfer",
            tripType: "oneway",
            pickupDate: "2026-06-25 10:00",
            origin: { lat: 51.4700, long: -0.4543 },
            destination: { lat: 51.4975, long: -0.1353 },
            from: "Heathrow Airport (LHR), London, UK",
            to: "Westminster, London, UK",
            passengers: 1
        }
    },
    {
        name: "Nice, France (NCE to Westminster Hotel)",
        payload: {
            journeyType: "airport_transfer",
            tripType: "oneway",
            pickupDate: "2026-06-28 10:00",
            origin: { lat: 43.6598, long: 7.2142 },
            destination: { lat: 43.6948, long: 7.2606 },
            from: "Nice Côte d'Azur Airport (NCE), France",
            to: "Westminster Hotel & Spa, Nice, France",
            passengers: 1
        }
    },
    {
        name: "Singapore (SIN to Marina Bay Sands)",
        payload: {
            journeyType: "airport_transfer",
            tripType: "oneway",
            pickupDate: "2026-06-27 09:00",
            origin: { lat: 1.3644, long: 103.9915 },
            destination: { lat: 1.2847, long: 103.8610 },
            from: "Changi Airport (SIN), Singapore",
            to: "Marina Bay Sands, Singapore",
            passengers: 1
        }
    }
];

async function runTests() {
    console.log("Starting International Cabs Tests...\n");
    for (const testCase of cases) {
        console.log(`Testing Case: ${testCase.name}`);
        try {
            const res = await axios.post('http://localhost:8084/search/quotes', testCase.payload);
            const quotes = res.data?.data?.quotesInfo || [];
            console.log(`  Success: ${res.data?.success}`);
            console.log(`  Vehicles Found: ${quotes.length}`);
            if (quotes.length > 0) {
                const q = quotes[0].quotes?.[0];
                console.log(`  First Quote: ${quotes[0].vehicleCategory} - ${q?.fareBreakup?.totalFare} ${q?.fareBreakup?.currency || 'INR'}`);
            }
        } catch (err) {
            console.log(`  Error: ${err.response?.status || 'Unknown'}`);
            console.log(`  Message: ${JSON.stringify(err.response?.data?.message || err.message)}`);
        }
        console.log("-".repeat(40));
    }
}

runTests();
