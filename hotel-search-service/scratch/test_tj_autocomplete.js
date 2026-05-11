const axios = require('axios');

async function testTJAutocomplete() {
    const apiKey = "717512708b4ba99-786c-46c9-a801-37891e3a8bab";
    const agencyId = "KLAR114";
    const baseUrl = "https://apitest.tripjack.com";

    const endpoints = [
        "/hms/v1/static-data/autocomplete",
        "/hms/v1/hotel/autocomplete",
        "/oms/v1/hotel/autocomplete",
        "/hms/v1/static-data/hotel-list"
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`Testing ${endpoint}...`);
            const response = await axios.post(baseUrl + endpoint, {
                query: "Panama"
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "apikey": apiKey,
                    "AgencyId": agencyId
                },
                timeout: 5000
            });
            console.log(`✅ ${endpoint} success:`, JSON.stringify(response.data, null, 2).substring(0, 500));
        } catch (error) {
            console.log(`❌ ${endpoint} failed: ${error.message}`);
        }
    }
}

testTJAutocomplete();
