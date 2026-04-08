import axios from "axios";
import { HotelModel } from "../models/Hotel.model";
import { env } from "../config/env";

// Static data endpoint uses a different base URL than the search/listing APIs
const TJ_STATIC_BASE_URL = "https://apitest.tripjack.com";

export async function syncTJHotels() {
    // Optimization: Skip sync if we already have hotels to avoid hitting memory/quota limits
    const existingCount = await HotelModel.countDocuments();
    if (existingCount > 0) {
        console.log(`[Sync] Skip TripJack Hotels Sync: DB already has ${existingCount} hotels.`);
        return;
    }

    console.log("[Sync] Starting TripJack Hotels Sync...");

    let hasNext = true;
    let nextToken: string | undefined = undefined;
    let totalCount = 0;
    let pageCount = 0;

    try {
        while (hasNext) {
            const payload: any = {
                next: nextToken || undefined,
            };

            if (nextToken) {
                console.log(`[Sync] Requesting next page (v1 top-level) with token: ${nextToken.substring(0, 20)}...`);
            }

            let res: any;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    res = await axios.post(
                        `${TJ_STATIC_BASE_URL}/hms/v1/fetch-static-hotels`,
                        payload,
                        {
                            headers: {
                                "Content-Type": "application/json",
                                "apikey": env.tripJack.apiKey,
                                "Accept": "application/json",
                                "Accept-Encoding": "gzip",
                            },
                            timeout: 60000,
                        }
                    );
                    break; // Success, exit retry loop
                } catch (err: any) {
                    retryCount++;
                    const status = err.response?.status;
                    if (retryCount < maxRetries && (status >= 500 || !status)) {
                        const delay = retryCount * 2000;
                        console.warn(`[Sync] TripJack API ${status || 'Error'} (Page ${pageCount + 1}). Retrying in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`);
                        await new Promise(r => setTimeout(r, delay));
                    } else {
                        throw err; // Re-throw if exhausted or not a retryable error
                    }
                }
            }

            const data = res.data;
            const hotels = data.hotelOpInfos || data.hotels || [];
            if (hotels.length === 0) {
                console.log("[Sync] No hotels found in current page. Stopping.");
                hasNext = false;
                break;
            }

            pageCount++;

            // Build bulk operations for this page
            const bulkOps = [];
            for (const hotel of hotels) {
                if (hotel.isDeleted || !hotel.tjHotelId) continue;

                // TJ v1 mapping: geolocation is { lt, ln }
                const lat = parseFloat(hotel.geolocation?.lt) || 0;
                const lng = parseFloat(hotel.geolocation?.ln) || 0;

                // TJ v1 mapping: city and country are in the address object
                const cityName = (hotel.address?.city?.name || hotel.cityName || "").toLowerCase().trim();
                const countryName = hotel.address?.country?.name || hotel.countryName || "";
                const addressStr = hotel.address?.adr || hotel.address || "";

                // TJ v1 mapping: images are objects with url
                const imageUrls = Array.isArray(hotel.images)
                    ? hotel.images.map((img: any) => typeof img === 'string' ? img : img.url).filter(Boolean)
                    : [];

                bulkOps.push({
                    updateOne: {
                        filter: { tjHotelId: String(hotel.tjHotelId) },
                        update: {
                            $set: {
                                name: hotel.name || "",
                                cityName,
                                countryName,
                                starRating: parseInt(hotel.rating) || parseInt(hotel.starCategory) || 0,
                                address: addressStr,
                                location: {
                                    type: "Point",
                                    coordinates: [lng, lat],
                                },
                                images: imageUrls,
                                lastUpdated: new Date(),
                            },
                        },
                        upsert: true,
                    },
                });

                totalCount++;
            }

            if (bulkOps.length > 0) {
                await HotelModel.bulkWrite(bulkOps, { ordered: false });
            }

            console.log(
                `[Sync] Page ${pageCount}: Upserted ${bulkOps.length} hotels (total: ${totalCount})`
            );

            if (data.next) {
                nextToken = data.next;
                // Small delay to avoid rate limiting
                await new Promise((r) => setTimeout(r, 500));
            } else {
                hasNext = false;
            }
        }

        // Log final stats from DB
        const dbCount = await HotelModel.countDocuments();
        const cityCount = await HotelModel.distinct("cityName").then(
            (cities) => cities.length
        );
        console.log(
            `[Sync] TripJack Hotels Sync Complete. DB has ${dbCount} hotels across ${cityCount} cities.`
        );
    } catch (error: any) {
        console.error(`[Sync] TripJack Sync Failed:`, error.message);
    }
}
