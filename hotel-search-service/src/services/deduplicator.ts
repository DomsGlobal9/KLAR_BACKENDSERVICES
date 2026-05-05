import { UnifiedHotel } from "../types/unified";

export interface DeduplicationMeta {
    duplicatedCount: number;
    byExactId: number;
    byExactGeo: number;
    bySimilarGeoAndName: number;
}

export function deduplicateHotels(hotels: UnifiedHotel[]): { items: UnifiedHotel[], meta: DeduplicationMeta } {
    const collapsed: UnifiedHotel[] = [];
    const meta: DeduplicationMeta = {
        duplicatedCount: 0,
        byExactId: 0,
        byExactGeo: 0,
        bySimilarGeoAndName: 0
    };
    
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
            let geoMatchReason = "";
            if (hotel.latitude && hotel.longitude && existing.latitude && existing.longitude) {
                const latDiff = Math.abs(hotel.latitude - existing.latitude);
                const lngDiff = Math.abs(hotel.longitude - existing.longitude);
                
                // If EXACT same coordinates (within practically zero range), assume same property
                if (latDiff === 0 && lngDiff === 0) {
                    isGeoSame = true;
                    geoMatchReason = "EXACT_GEO";
                } 
                // Or within ~100m AND similar names
                else if (latDiff < 0.001 && lngDiff < 0.001) {
                    isGeoSame = isNameSimilar(hotel.name, existing.name);
                    if (isGeoSame) geoMatchReason = "SIMILAR_GEO_AND_NAME";
                }
            }

            // Senior Dev: Only merge if they come from DIFFERENT providers.
            // As requested, we allow duplicates from the SAME provider.
            if (hotel.source === existing.source) continue;

            if (isSameId || isGeoSame) {
                const reason = isSameId ? "ID_MATCH" : geoMatchReason;
                
                console.log(`[DEDUP] 🤝 Merge Detected!`);
                console.log(`   ├─ New:      "${hotel.name}" (${hotel.source}, ₹${hotel.price})`);
                console.log(`   ├─ Existing: "${existing.name}" (${existing.source}, ₹${existing.price})`);
                console.log(`   ├─ Reason:   ${reason}`);

                const currentPrice = hotel.price || 0;
                const existingPrice = existing.price || 0;
                let winnerName = "";

                if (currentPrice > 0 && (currentPrice < existingPrice || existingPrice === 0)) {
                    winnerName = hotel.name;
                    const merged = { ...hotel };
                    if (hotel.source !== existing.source) {
                        merged.altDeal = { source: existing.source, price: existing.price };
                    }
                    collapsed[i] = merged as UnifiedHotel;
                } else {
                    winnerName = existing.name;
                    if (hotel.source !== existing.source) {
                        existing.altDeal = { source: hotel.source, price: hotel.price };
                    }
                }

                const geoInfo = isSameId ? `ID: ${hotel.hotelId}` : `Pin-to-Pin: [${hotel.latitude}, ${hotel.longitude}] vs [${existing.latitude}, ${existing.longitude}]`;
                console.log(`   └─ UI WINNER: "${winnerName}" (Cheaper) | ${geoInfo}`);

                // Tracking stats
                meta.duplicatedCount++;
                if (isSameId) {
                    meta.byExactId++;
                } else if (geoMatchReason === "EXACT_GEO") {
                    meta.byExactGeo++;
                } else if (geoMatchReason === "SIMILAR_GEO_AND_NAME") {
                    meta.bySimilarGeoAndName++;
                }

                matched = true;
                break;
            }
        }
        
        if (!matched) {
            collapsed.push(hotel);
        }
    }

    return { items: collapsed, meta };
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
