import { TripJackSearchPayload } from "../interface/flight/flight.interface";

export function isValidTripJackPayload(payload: any): payload is TripJackSearchPayload {
  return (
    payload &&
    payload.searchQuery &&
    Array.isArray(payload.searchQuery.routeInfos) &&
    payload.searchQuery.routeInfos.length > 0 &&
    payload.searchQuery.routeInfos.every((route: any) =>
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