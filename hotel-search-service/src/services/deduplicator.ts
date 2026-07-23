import { UnifiedHotel } from "../types/unified";

export interface DeduplicationMeta {
  duplicatedCount: number;
  byExactId: number;
  byExactGeo: number;
  bySimilarGeoAndName: number;
}

export function deduplicateHotels(hotels: UnifiedHotel[]): {
  items: UnifiedHotel[];
  meta: DeduplicationMeta;
} {
  const collapsed: UnifiedHotel[] = [];
  const meta: DeduplicationMeta = {
    duplicatedCount: 0,
    byExactId: 0,
    byExactGeo: 0,
    bySimilarGeoAndName: 0,
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
      const isSameId =
        hotel.hotelId && existing.hotelId && hotel.hotelId === existing.hotelId;

      // Geo-based similarity check
      let isGeoSame = false;
      let geoMatchReason = "";
      if (
        hotel.latitude &&
        hotel.longitude &&
        existing.latitude &&
        existing.longitude
      ) {
        const latDiff = Math.abs(hotel.latitude - existing.latitude);
        const lngDiff = Math.abs(hotel.longitude - existing.longitude);

        // If within ~100m (or exact), they MUST have similar names to be considered the same property.
        // Providers often return identical city-center coordinates for different hotels.
        if (latDiff < 0.001 && lngDiff < 0.001) {
          isGeoSame = isNameSimilar(hotel.name, existing.name);
          if (isGeoSame) {
            geoMatchReason = (latDiff === 0 && lngDiff === 0) ? "EXACT_GEO" : "SIMILAR_GEO_AND_NAME";
          }
        }
      }

      // [Senior Dev Update]
      // We now allow merging if they are from the SAME source BUT have the SAME ID.
      // This handles cases where a provider returns the same hotel multiple times (e.g. different rates).
      const shouldMerge =
        isSameId || (hotel.source !== existing.source && isGeoSame);

      if (shouldMerge) {
        const reason = isSameId ? "ID_MATCH" : geoMatchReason;

        console.log(`[DEDUP] 🤝 Merge Detected!`);
        console.log(
          `   ├─ New:      "${hotel.name}" (${hotel.source}, ₹${hotel.price})`,
        );
        console.log(
          `   ├─ Existing: "${existing.name}" (${existing.source}, ₹${existing.price})`,
        );
        console.log(`   ├─ Reason:   ${reason}`);

        const currentPrice = hotel.price || 0;
        const existingPrice = existing.price || 0;
        let winnerName = "";

        // Merge amenities and images from both sources
        const combinedAmenities = mergeAmenities(
          hotel.amenities || [],
          existing.amenities || [],
        );
        const combinedImages =
          hotel.images && hotel.images.length > 0
            ? hotel.images
            : existing.images || [];

        if (
          currentPrice > 0 &&
          (currentPrice < existingPrice || existingPrice === 0)
        ) {
          winnerName = hotel.name;
          const merged = { ...hotel };
          if (hotel.source !== existing.source) {
            merged.altDeal = { source: existing.source, price: existing.price };
          }
          merged.amenities = combinedAmenities;
          merged.images = combinedImages;
          collapsed[i] = merged as UnifiedHotel;
        } else {
          winnerName = existing.name;
          if (hotel.source !== existing.source) {
            existing.altDeal = { source: hotel.source, price: hotel.price };
          }
          existing.amenities = combinedAmenities;
          if (!existing.images || existing.images.length === 0) {
            existing.images = combinedImages;
          }
        }

        const geoInfo = isSameId
          ? `ID: ${hotel.hotelId}`
          : `Pin-to-Pin: [${hotel.latitude}, ${hotel.longitude}] vs [${existing.latitude}, ${existing.longitude}]`;
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
 * Enhanced name similarity check.
 * Strips non-alphanumeric chars and checks for containment,
 * but excludes very common generic terms if they are the only match.
 */
function isNameSimilar(name1: string, name2: string): boolean {
  const n1 = (name1 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const n2 = (name2 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n1 || !n2) return false;

  if (n1 === n2) return true;

  // Avoid merging if they are just generic names like "hotel" or "resort"
  const generics = [
    "hotel",
    "resort",
    "apartment",
    "villa",
    "hostel",
    "guesthouse",
    "inn",
    "suites",
  ];
  if (generics.includes(n1) || generics.includes(n2)) {
    return n1 === n2; // Must be exact if it's just a generic term
  }

  // If one contains the other, ensure the overlap is significant (not just "Hotel Taj" vs "Taj")
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = n1.length < n2.length ? n1 : n2;
    return shorter.length > 5;
  }

  return false;
}

function mergeAmenities(arr1: string[], arr2: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...(arr1 || []), ...(arr2 || [])]) {
    if (!item) continue;
    const normalized = item.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(item);
    }
  }
  return result;
}
