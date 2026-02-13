import { TripJackSearchPayload } from "../interface/flight/flight.interface";

export function extractSearchParams(payload: TripJackSearchPayload) {
    const firstRoute = payload.searchQuery.routeInfos[0];
    const secondRoute = payload.searchQuery.routeInfos[1];

    return {
        from: firstRoute.fromCityOrAirport.code,
        to: firstRoute.toCityOrAirport.code,
        travelDate: firstRoute.travelDate,
        returnDate: secondRoute?.travelDate,
        passengers: payload.searchQuery.paxInfo,
        cabinClass: payload.searchQuery.cabinClass
    };
}