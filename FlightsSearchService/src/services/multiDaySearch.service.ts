import { getFlightList } from "../utils/flightTransformer";
import { detectTripType, getTripInfos } from "../utils/tripTypeDetector";
import { searchFromTripJack } from "./tripjackService";

export const searchFlightsForMultipleDays = async (
    basePayload: any,
    startDate: Date,
    endDate: Date
) => {
    const dates = generateDateRange(startDate, endDate);

    const searchPromises = dates.map(async (date) => {
        const datePayload = JSON.parse(JSON.stringify(basePayload));
        datePayload.searchQuery.routeInfos[0].departureDate = formatDate(date);

        if (datePayload.searchQuery.routeInfos.length > 1) {
            const returnDate = new Date(date);
            returnDate.setDate(returnDate.getDate() + 1);
            datePayload.searchQuery.routeInfos[1].departureDate = formatDate(returnDate);
        }

        try {
            const data = await searchFromTripJack(datePayload);
            const tripType = detectTripType(datePayload);
            const tripInfos = getTripInfos(data, tripType);
            const flightData = getFlightList(tripInfos, tripType);

            return {
                date: formatDate(date),
                success: true,
                flightData,
                rawData: data,
                flightCount: flightData.length,
                minPrice: calculateMinPrice(flightData)
            };
        } catch (error: any) {
            console.error(`Failed to fetch flights for date ${formatDate(date)}:`, error);
            return {
                date: formatDate(date),
                success: false,
                flightData: [],
                error: error.message,
                flightCount: 0,
                minPrice: null
            };
        }
    });

    const results = await Promise.allSettled(searchPromises);

    return results.map((result) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return {
                date: formatDate(new Date()),
                success: false,
                flightData: [],
                error: result.reason?.message || 'Unknown error',
                flightCount: 0,
                minPrice: null
            };
        }
    });
};

const generateDateRange = (start: Date, end: Date): Date[] => {
    const dates: Date[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
};

const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const calculateMinPrice = (flightData: any[]): number | null => {
    if (!flightData || flightData.length === 0) return null;
    return Math.min(...flightData.map(flight => flight?.fare?.totalPrice || Infinity));
};