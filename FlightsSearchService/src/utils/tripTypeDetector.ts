import { TripJackSearchPayload } from "../interface/flight/flight.interface";

export type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';

export function detectTripType(payload: TripJackSearchPayload): TripType {
    const routeCount = payload.searchQuery.routeInfos.length;

    if (routeCount === 1) return 'ONE_WAY';
    if (routeCount === 2) return 'RETURN';
    return 'MULTI_CITY';
}

export function getTripInfos(data: any, tripType: TripType) {
    const tripInfos = data.searchResult?.tripInfos || {};
    const keys = Object.keys(tripInfos);

    console.log("📊 TripInfos keys received:", keys);

    // CASE 1: If we have ONWARD/RETURN keys, use them
    if (tripInfos.ONWARD || tripInfos.RETURN) {
        if (tripType === 'ONE_WAY') {
            return tripInfos.ONWARD || [];
        }
        if (tripType === 'RETURN') {
            return {
                ONWARD: tripInfos.ONWARD || [],
                RETURN: tripInfos.RETURN || []
            };
        }
    }

    // CASE 2: If we have numeric keys (0, 1, 2)
    const numericKeys = keys.filter(key => !isNaN(Number(key)) && key !== 'ONWARD' && key !== 'RETURN');

    if (numericKeys.length > 0) {
        // If it's a RETURN trip with 2 legs
        if (tripType === 'RETURN' && numericKeys.length >= 2) {
            return {
                ONWARD: tripInfos[0] || [],
                RETURN: tripInfos[1] || []
            };
        }

        // If it's MULTI_CITY or has more than 2 legs
        const multiCityInfos: Record<string, any> = {};
        numericKeys.forEach(key => {
            multiCityInfos[key] = tripInfos[key];
        });
        return multiCityInfos;
    }

    // Fallback
    return tripType === 'ONE_WAY' ? [] :
        tripType === 'RETURN' ? { ONWARD: [], RETURN: [] } :
            {};
}