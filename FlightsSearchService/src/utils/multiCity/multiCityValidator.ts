import { TripJackSearchPayload } from "../../interface/flight/flight.interface";

export function isValidMultiCityPayload(payload: any): payload is TripJackSearchPayload {
    const routeInfos = payload?.searchQuery?.routeInfos;

    return (
        payload &&
        payload.searchQuery &&
        Array.isArray(routeInfos) &&
        routeInfos.length >= 2 && 
        routeInfos.every((route: any) =>
            typeof route.fromCityOrAirport?.code === 'string' &&
            typeof route.toCityOrAirport?.code === 'string' &&
            typeof route.travelDate === 'string'
        ) &&
        payload.searchQuery.paxInfo &&
        typeof payload.searchQuery.paxInfo.ADULT === 'number' &&
        typeof payload.searchQuery.paxInfo.CHILD === 'number' &&
        typeof payload.searchQuery.paxInfo.INFANT === 'number'
    );
}