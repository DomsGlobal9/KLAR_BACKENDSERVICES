export function formatFlightResponse(
    flightData: any,
    tripType: string,
    routeCount: number,
    searchParams: any,
    sortOptions?: any,
    filters?: any,
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
            sortApplied: sortOptions,
            appliedFilters: filters || {},
            filterSummary: filters ? getFilterSummary(filters) : undefined
        }
    };
}

function getFilterSummary(filters: any) {
    const summary: string[] = [];

    if (filters.stops?.length) {
        summary.push(`Stops: ${filters.stops.join(', ')}`);
    }
    if (filters.refundType?.length) {
        summary.push(`Fare type: ${filters.refundType.join(', ')}`);
    }
    if (filters.priceRange) {
        summary.push(`Price: ₹${filters.priceRange.min} - ₹${filters.priceRange.max}`);
    }
    if (filters.arrivalTime?.length) {
        summary.push(`Arrival: ${filters.arrivalTime.join(', ')}`);
    }

    return summary;
}