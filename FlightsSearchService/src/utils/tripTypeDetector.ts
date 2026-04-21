import { TripJackSearchPayload } from "../interface/flight/flight.interface";

export type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';

// export function detectTripType(payload: TripJackSearchPayload): TripType {
//     const routeCount = payload.searchQuery.routeInfos.length;

//     if (routeCount === 1) return 'ONE_WAY';
//     if (routeCount === 2) return 'RETURN';
//     return 'MULTI_CITY';
// }

export function detectTripType(payload: TripJackSearchPayload): TripType {
    const routeInfos = payload.searchQuery.routeInfos;
    const routeCount = routeInfos.length;

    if (routeCount === 1) return 'ONE_WAY';

    if (routeCount === 2) {
        const first = routeInfos[0];
        const second = routeInfos[1];


        if (first.toCityOrAirport.code === second.fromCityOrAirport.code &&
            first.fromCityOrAirport.code === second.toCityOrAirport.code) {
            return 'RETURN';
        }

        return 'MULTI_CITY';
    }
    return 'MULTI_CITY';
}

export function getTripInfos(data: any, tripType: TripType) {
    const tripInfos = data.searchResult?.tripInfos || {};
    const keys = Object.keys(tripInfos);

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

    const numericKeys = keys.filter(key => !isNaN(Number(key)) && key !== 'ONWARD' && key !== 'RETURN');

    if (numericKeys.length > 0) {
        if (tripType === 'MULTI_CITY') {
            const multiCityInfos: Record<string, any> = {};
            numericKeys.forEach(key => {
                multiCityInfos[key] = tripInfos[key];
            });
            return multiCityInfos;
        }

        if (tripType === 'RETURN' && numericKeys.length >= 2) {
            return {
                ONWARD: tripInfos[0] || [],
                RETURN: tripInfos[1] || []
            };
        }

        const multiCityInfos: Record<string, any> = {};
        numericKeys.forEach(key => {
            multiCityInfos[key] = tripInfos[key];
        });
        return multiCityInfos;
    }

    return tripType === 'ONE_WAY' ? [] :
        tripType === 'RETURN' ? { ONWARD: [], RETURN: [] } :
            {};
}