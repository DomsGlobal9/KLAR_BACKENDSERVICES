import { TripJackSearchPayload } from "../interface/flight/flight.interface";

export type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';

export function detectTripType(payload: TripJackSearchPayload): TripType {
    const routeCount = payload.searchQuery.routeInfos.length;

    if (routeCount === 1) return 'ONE_WAY';
    if (routeCount === 2) return 'RETURN';
    return 'MULTI_CITY';
}

export function getTripInfos(data: any, tripType: TripType) {
    if (tripType === 'ONE_WAY') {
        return data.searchResult?.tripInfos?.ONWARD || [];
    }

    if (tripType === 'RETURN') {
        return {
            ONWARD: data.searchResult?.tripInfos?.ONWARD || [],
            RETURN: data.searchResult?.tripInfos?.RETURN || []
        };
    }

    // MULTI_CITY
    const tripInfos: Record<string, any> = {};
    Object.keys(data.searchResult?.tripInfos || {}).forEach(key => {
        if (key !== 'ONWARD' && key !== 'RETURN') {
            tripInfos[key] = data.searchResult.tripInfos[key];
        }
    });
    return tripInfos;
}