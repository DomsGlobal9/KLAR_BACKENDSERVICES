const jwt = require("jsonwebtoken");

async function verify() {
    const token = jwt.sign(
        { id: "test-user", role: "user", email: "test@domain.com" },
        "your_super_secret_jwt_key_change_me_in_production",
        { expiresIn: "10m" }
    );
    const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

    const searchConfigs = [
        { city: "Dubai", dest: "DXB" },
        { city: "Monaco", dest: "MCO" }
    ];

    const results = {};

    for (const config of searchConfigs) {
        console.log(`\n--- Searching in ${config.city} ---`);
        const body = {
            destination: config.city,
            checkin: "2026-09-10",
            checkout: "2026-09-12",
            rooms: [ { adults: 2, children: 1, childAges: [5] } ],
            countryCode: "IN"
        };

        try {
            const res = await fetch("http://localhost:5012/", {
                method: "POST", headers, body: JSON.stringify(body)
            }).then(r => r.json());

            if (res.results) {
                const rgHotels = res.results.filter(h => !h.hotelId.startsWith("TJ:"));
                const tjHotels = res.results.filter(h => h.hotelId.startsWith("TJ:"));
                
                console.log(`Dubai: RG=${rgHotels.length}, TJ=${tjHotels.length}`);
                
                const bestRG = rgHotels.sort((a,b) => b.starRating - a.starRating)[0];
                const bestTJ = tjHotels.sort((a,b) => b.starRating - a.starRating)[0];
                
                if (bestRG) console.log(`Best RG: ${bestRG.name} (${bestRG.starRating}*) - ID: ${bestRG.hotelId}`);
                if (bestTJ) console.log(`Best TJ: ${bestTJ.name} (${bestTJ.starRating}*) - ID: ${bestTJ.hotelId}`);
                
                results[config.city] = { bestRG, bestTJ };
            }
        } catch (e) {
            console.error(`Search failed for ${config.city}:`, e.message);
        }
    }
}

verify();
