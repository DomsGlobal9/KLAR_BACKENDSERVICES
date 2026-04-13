import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

const TJ_STATIC_BASE_URL = "https://apitest.tripjack.com";
const API_KEY = process.env.TRIPJACK_API_KEY;

async function countHotels() {
    console.log("Checking total hotels in TripJack API...");
    
    let hasNext = true;
    let nextToken: string | undefined = undefined;
    let totalHotels = 0;
    let page = 1;

    try {
        while (hasNext) {
            const payload: any = {
                next: nextToken || undefined,
            };

            const res = await axios.post(
                `${TJ_STATIC_BASE_URL}/hms/v1/fetch-static-hotels`,
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": API_KEY,
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip",
                    },
                    timeout: 60000,
                }
            );

            const data = res.data;
            const hotels = data.hotelOpInfos || data.hotels || [];
            
            if (hotels.length === 0) {
                hasNext = false;
                break;
            }

            totalHotels += hotels.length;
            console.log(`Page ${page}: ${hotels.length} hotels (Total so far: ${totalHotels})`);

            if (data.next) {
                nextToken = data.next;
                page++;
                // Small delay to be polite
                await new Promise(r => setTimeout(r, 200));
            } else {
                hasNext = false;
            }
        }

        console.log("\n========================================");
        console.log(`FINAL TOTAL HOTELS IN TRIPJACK API: ${totalHotels}`);
        console.log("========================================\n");

    } catch (error: any) {
        console.error("Error fetching hotels:", error.response?.data || error.message);
    }
}

countHotels();
