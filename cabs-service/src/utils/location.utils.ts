import { tripJackCabsProvider } from "../providers/tripjack.cabs.provider";

export interface ResolvedAddress {
    city: string;
    country: string;
    postalCode?: string;
}

const addressCache = new Map<string, { timestamp: number; data: ResolvedAddress }>();
const ADDRESS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24h — place addresses don't change
const ADDRESS_CACHE_MAX = 5000;

/**
 * Resolve a display address to real {city, country, postalCode} using TripJack's
 * own location APIs (google-places -> get-lat-long), so quotes/bookings carry
 * the exact address data the supplier expects. TripJack's quotes API 404s
 * ("No Cabs Found!") when city/country don't match its data, so dynamic
 * resolution is the primary path; the static string parsers below are only the
 * fallback when the location APIs are unreachable.
 */
export const resolveAddress = async (displayAddress: string): Promise<ResolvedAddress> => {
    const fallback = (): ResolvedAddress => ({
        city: getCityFromAddress(displayAddress),
        country: getCountryFromAddress(displayAddress) || "India",
    });

    if (!displayAddress || !displayAddress.trim()) return fallback();

    const cacheKey = displayAddress.trim().toLowerCase();
    const cached = addressCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ADDRESS_CACHE_TTL) return cached.data;

    try {
        const placesRes = await tripJackCabsProvider.googlePlaces(displayAddress);
        const place = placesRes?.data?.places?.[0];
        const placeId = place?.id || place?.value;
        if (!placeId) return fallback();

        const latLongRes = await tripJackCabsProvider.getLatLong(placeId);
        // Doc shows both shapes: data.address and data.places[0].address
        const address = latLongRes?.data?.address || latLongRes?.data?.places?.[0]?.address;
        if (!address?.city || !address?.country) return fallback();

        const resolved: ResolvedAddress = {
            city: String(address.city),
            country: String(address.country),
            ...(address.postalCode ? { postalCode: String(address.postalCode) } : {}),
        };
        if (addressCache.size >= ADDRESS_CACHE_MAX) addressCache.clear();
        addressCache.set(cacheKey, { timestamp: Date.now(), data: resolved });
        return resolved;
    } catch (err: any) {
        console.warn(
            `[LocationUtils] Dynamic address resolution failed for "${displayAddress}": ${err?.message || err}`,
        );
        return fallback();
    }
};

/** A location already carrying usable supplier address data. */
export const hasCompleteAddress = (loc: any): boolean =>
    Boolean(loc?.address?.city && loc?.address?.country);

/**
 * Ensure a LocationDto carries {city, country} — keep what the client sent when
 * complete, otherwise resolve dynamically from the display address.
 */
export const ensureLocationAddress = async (loc: any): Promise<any> => {
    if (!loc) return loc;
    if (hasCompleteAddress(loc)) return { ...loc, type: "location" };
    const resolved = await resolveAddress(loc.displayAddress);
    const postalCode = loc.address?.postalCode || resolved.postalCode;
    return {
        ...loc,
        type: "location",
        address: {
            ...(loc.address || {}),
            city: loc.address?.city || resolved.city,
            country: loc.address?.country || resolved.country,
            ...(postalCode ? { postalCode } : {}),
        },
    };
};

const knownStates = new Set([
    'telangana', 'maharashtra', 'karnataka', 'tamil nadu', 'delhi', 'uttar pradesh', 
    'gujarat', 'rajasthan', 'west bengal', 'kerala', 'haryana', 'punjab', 'bihar',
    'madhya pradesh', 'andhra pradesh', 'odisha', 'jharkhand', 'assam', 'chhattisgarh',
    'goa', 'uttarakhand', 'himachal pradesh', 'jammu and kashmir', 'ladakh'
]);

export const getCityFromAddress = (addressStr: string) => {
    if (!addressStr) return "City";
    const parts = addressStr.split(',').map(p => p.trim());
    if (parts.length === 1) return parts[0];
    
    const knownCountries = [
        'uk', 'united kingdom', 'us', 'usa', 'united states', 'australia', 'canada', 
        'uae', 'united arab emirates', 'singapore', 'france', 'germany', 'malaysia', 
        'thailand', 'japan', 'china', 'italy', 'spain', 'netherlands', 'switzerland',
        'sweden', 'norway', 'denmark', 'finland', 'russia', 'brazil', 'mexico',
        'argentina', 'south africa', 'turkey', 'egypt', 'saudi arabia', 'qatar',
        'oman', 'kuwait', 'bahrain', 'vietnam', 'philippines', 'indonesia', 'new zealand', 'india'
    ];

    let filtered = parts;
    const lastPart = parts[parts.length - 1].toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (knownCountries.includes(lastPart) || lastPart.includes('emirates') || lastPart.includes('india')) {
        filtered = parts.slice(0, -1);
    }
    if (filtered.length === 0) return "City";
    
    const lastFiltered = filtered[filtered.length - 1].toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (knownStates.has(lastFiltered) && filtered.length > 1) {
        return filtered[filtered.length - 2];
    }
    
    return filtered[filtered.length - 1];
};

export const getCountryFromAddress = (addressStr: string) => {
    if (!addressStr) return "India";
    const parts = addressStr.split(',').map(p => p.trim());
    const lastPart = parts[parts.length - 1].toLowerCase().replace(/[^a-z\s]/g, '').trim();
    
    const knownCountries = [
        'uk', 'united kingdom', 'us', 'usa', 'united states', 'australia', 'canada', 
        'uae', 'united arab emirates', 'singapore', 'france', 'germany', 'malaysia', 
        'thailand', 'japan', 'china', 'italy', 'spain', 'netherlands', 'switzerland',
        'sweden', 'norway', 'denmark', 'finland', 'russia', 'brazil', 'mexico',
        'argentina', 'south africa', 'turkey', 'egypt', 'saudi arabia', 'qatar',
        'oman', 'kuwait', 'bahrain', 'vietnam', 'philippines', 'indonesia', 'new zealand', 'india'
    ];
    
    if (knownCountries.includes(lastPart)) {
        return parts[parts.length - 1]; 
    }
    
    if (lastPart.includes('emirates')) return "United Arab Emirates";
    
    // Check if "India" is explicitly present in any part
    if (parts.some(p => p.toLowerCase().includes('india'))) {
        return "India";
    }

    // Default Fallback: If it's not a known international country, it's likely India (City/State format)
    return "India";
};
