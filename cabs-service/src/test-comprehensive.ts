import dotenv from "dotenv";
dotenv.config();
import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";

async function runComprehensiveTests() {
    console.log("🚀 Starting Comprehensive Cabs API Verification (20 Locations)...\n");

    const indiaCases = [
        { name: "Delhi Airport to CP", source: "Indira Gandhi International Airport, Delhi", dest: "Connaught Place, New Delhi" },
        { name: "Mumbai Airport to Marine Drive", source: "Chhatrapati Shivaji Maharaj International Airport, Mumbai", dest: "Marine Drive, Mumbai" },
        { name: "Bangalore Airport to Whitefield", source: "Kempegowda International Airport, Bengaluru", dest: "Whitefield, Bengaluru" },
        { name: "Chennai Airport to T-Nagar", source: "Chennai International Airport, Chennai", dest: "T. Nagar, Chennai" },
        { name: "Kolkata Airport to Howrah Bridge", source: "Netaji Subhash Chandra Bose International Airport, Kolkata", dest: "Howrah Bridge, Kolkata" },
        { name: "Hyderabad Airport to Banjara Hills", source: "Rajiv Gandhi International Airport, Hyderabad", dest: "Banjara Hills, Hyderabad" },
        { name: "Pune Airport to Koregaon Park", source: "Pune Airport, Pune", dest: "Koregaon Park, Pune" },
        { name: "Ahmedabad Airport to Sabarmati", source: "Sardar Vallabhbhai Patel International Airport, Ahmedabad", dest: "Sabarmati, Ahmedabad" },
        { name: "Jaipur Airport to Hawa Mahal", source: "Jaipur International Airport, Jaipur", dest: "Hawa Mahal, Jaipur" },
        { name: "Kochi Airport to Fort Kochi", source: "Cochin International Airport, Kochi", dest: "Fort Kochi, Kerala" }
    ];

    const internationalCases = [
        { name: "Dubai Airport to Burj Khalifa", source: "Dubai International Airport (DXB), Dubai, UAE", dest: "Burj Khalifa, Dubai, UAE" },
        { name: "London Heathrow to Piccadilly", source: "London Heathrow Airport (LHR), London, UK", dest: "Piccadilly Circus, London, UK" },
        { name: "Singapore Changi to Marina Bay", source: "Singapore Changi Airport (SIN), Singapore", dest: "Marina Bay Sands, Singapore" },
        { name: "JFK to Times Square", source: "John F. Kennedy International Airport (JFK), New York, USA", dest: "Times Square, New York, USA" },
        { name: "Paris CDG to Eiffel Tower", source: "Charles de Gaulle Airport (CDG), Roissy-en-France, France", dest: "Eiffel Tower, Paris, France" },
        { name: "Bangkok to Sukhumvit", source: "Suvarnabhumi Airport (BKK), Bangkok, Thailand", dest: "Sukhumvit Road, Bangkok, Thailand" },
        { name: "Sydney Airport to Opera House", source: "Sydney Airport (SYD), Sydney, Australia", dest: "Sydney Opera House, Sydney, Australia" },
        { name: "Tokyo Narita to Shinjuku", source: "Narita International Airport (NRT), Narita, Japan", dest: "Shinjuku Station, Tokyo, Japan" },
        { name: "Abu Dhabi to Sheikh Zayed Mosque", source: "Zayed International Airport (AUH), Abu Dhabi, UAE", dest: "Sheikh Zayed Grand Mosque, Abu Dhabi, UAE" },
        { name: "Doha Hamad to Souq Waqif", source: "Hamad International Airport (DOH), Doha, Qatar", dest: "Souq Waqif, Doha, Qatar" }
    ];

    const allCases = [...indiaCases.map(c => ({...c, type: 'INDIA'})), ...internationalCases.map(c => ({...c, type: 'INTL'}))];
    const results: any[] = [];

    for (const c of allCases) {
        console.log(`\n==================================================`);
        console.log(`🚕 Testing ${c.type}: ${c.name}`);
        console.log(`==================================================`);
        
        try {
            // 1. Resolve Source
            const sourceRes = await tripJackCabsProvider.googlePlaces(c.source);
            const sourcePlace = sourceRes.data?.places?.[0];
            if (!sourcePlace) throw new Error(`Source not found: ${c.source}`);

            // 2. Resolve Dest
            const destRes = await tripJackCabsProvider.googlePlaces(c.dest);
            const destPlace = destRes.data?.places?.[0];
            if (!destPlace) throw new Error(`Destination not found: ${c.dest}`);

            // 3. Lat/Long
            const sLL = await tripJackCabsProvider.getLatLong(sourcePlace.id);
            const dLL = await tripJackCabsProvider.getLatLong(destPlace.id);

            const payload = {
                pickupDate: "2026-06-23 10:00",
                origin: {
                    type: "location",
                    displayAddress: sourcePlace.displayLabel,
                    lat: sLL.data.location.lat.toString(),
                    long: sLL.data.location.lng.toString(),
                    address: {
                        city: sLL.data.address.city || sLL.data.address.subLocality || "",
                        country: sLL.data.address.country || (c.type === 'INDIA' ? 'India' : '')
                    }
                },
                destination: {
                    type: "location",
                    displayAddress: destPlace.displayLabel,
                    lat: dLL.data.location.lat.toString(),
                    long: dLL.data.location.lng.toString(),
                    address: {
                        city: dLL.data.address.city || dLL.data.address.subLocality || "",
                        country: dLL.data.address.country || (c.type === 'INDIA' ? 'India' : '')
                    }
                },
                journeyType: "airport_transfer",
                tripType: "oneway",
                passengers: 1
            };

            const quotes = await tripJackCabsProvider.getQuotes(payload);
            const found = quotes.data?.quotesInfo?.length || 0;
            
            console.log(`✅ Result: Found ${found} categories.`);
            results.push({ name: c.name, type: c.type, status: 'SUCCESS', found, payload });

        } catch (err: any) {
            console.error(`❌ Result: FAILED - ${err.message || err}`);
            results.push({ name: c.name, type: c.type, status: 'FAILED', error: err.message || err });
        }
    }

    console.log("\n\n📊 FINAL TEST SUMMARY 📊");
    console.table(results.map(r => ({ Name: r.name, Type: r.type, Status: r.status, Categories: r.found || 0 })));
    
    console.log("\n👋 Comprehensive Test Finished.");
}

runComprehensiveTests().catch(console.error);
