import { UnifiedHotel } from "../types/unified";

export function deduplicateHotels(hotels: UnifiedHotel[]): UnifiedHotel[] {
    const collapsed: UnifiedHotel[] = [];
    
    for (const hotel of hotels) {
        let matched = false;
        for (let i = 0; i < collapsed.length; i++) {
            const existing = collapsed[i];
            
            /**
             * DEDUPLICATION CRITERIA:
             * 1. Same Hotel ID (regardless of source) -> Definitely same hotel.
             * 2. (Opt) Similar Lat/Lng AND Similar Names -> Likely same hotel.
             */
            const isSameId = hotel.hotelId && existing.hotelId && hotel.hotelId === existing.hotelId;
            
            // Geo-based similarity check
            let isGeoSame = false;
            if (hotel.latitude && hotel.longitude && existing.latitude && existing.longitude) {
                const latDiff = Math.abs(hotel.latitude - existing.latitude);
                const lngDiff = Math.abs(hotel.longitude - existing.longitude);
                // Within ~100m
                if (latDiff < 0.001 && lngDiff < 0.001) {
                    isGeoSame = isNameSimilar(hotel.name, existing.name);
                }
            }

            if (isSameId || isGeoSame) {
                // Merge: keep the cheaper one as the lead deal
                const currentPrice = hotel.price || 0;
                const existingPrice = existing.price || 0;

                if (currentPrice > 0 && (currentPrice < existingPrice || existingPrice === 0)) {
                    // Current hotel is cheaper: keep it and attach the other as an alt deal
                    collapsed[i] = { 
                        ...hotel, 
                        altDeal: { source: existing.source, price: existing.price } 
                    } as UnifiedHotel;
                } else if (existingPrice > 0) {
                    // Existing is cheaper or same: stay with it and attach current as alt deal
                    existing.altDeal = { source: hotel.source, price: hotel.price };
                }
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            collapsed.push(hotel);
        }
    }

    return collapsed;
}

/**
 * Basic name similarity check. 
 * Strips non-alphanumeric chars and checks for containment.
 */
function isNameSimilar(name1: string, name2: string): boolean {
    const n1 = (name1 || "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const n2 = (name2 || "").toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!n1 || !n2) return false;
    return n1.includes(n2) || n2.includes(n1);
}
