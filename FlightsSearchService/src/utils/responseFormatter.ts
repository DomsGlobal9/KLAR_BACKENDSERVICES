export function formatFlightResponse(
    flightData: any,
    tripType: string,
    routeCount: number,
    searchParams: any,
    sortOptions?: any
) {
    return {
        success: true,
        message: "Flights searched successfully",
        data: {
            searchType: tripType,
            routeCount,
            flights: flightData,
            totalFlights: Array.isArray(flightData)
                ? flightData.length
                : Object.keys(flightData).length,
            searchParams,
            sortApplied: sortOptions
        }
    };
}