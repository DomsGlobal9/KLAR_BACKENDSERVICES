import { getFlightList } from "../utils/flightTransformer";
import { detectTripType, getTripInfos } from "../utils/tripTypeDetector";
import { searchFromTripJack } from "./tripjackService";
import { TransformedFlight } from "../interface/flight/flight.interface";

export const searchFlightsForMultipleDays = async (
    basePayload: any,
    startDate: Date,
    endDate: Date
) => {
    const dates = generateDateRange(startDate, endDate);

    const searchPromises = dates.map(async (date) => {
        const datePayload = JSON.parse(JSON.stringify(basePayload));
        datePayload.searchQuery.routeInfos[0].travelDate = formatDate(date); // Fixed: changed departureDate to travelDate

        if (datePayload.searchQuery.routeInfos.length > 1) {
            const returnDate = new Date(date);
            returnDate.setDate(returnDate.getDate() + 1);
            datePayload.searchQuery.routeInfos[1].travelDate = formatDate(returnDate); // Fixed: changed departureDate to travelDate
        }

        try {
            const data = await searchFromTripJack(datePayload);
            const tripType = detectTripType(datePayload);
            const tripInfos = getTripInfos(data, tripType);
            const flightDataResult = getFlightList(tripInfos, tripType);

            // Extract flights based on trip type
            let flights: TransformedFlight[] = [];
            let flightCount = 0;
            let minPrice: number | null = null;

            if (tripType === 'ONE_WAY') {
                flights = flightDataResult.data as TransformedFlight[];
                flightCount = flights.length;
                minPrice = calculateMinPrice(flights);
            }
            else if (tripType === 'RETURN') {
                const returnData = flightDataResult.data as { onward: TransformedFlight[], return: TransformedFlight[] };
                flights = [...returnData.onward, ...returnData.return];
                flightCount = returnData.onward.length + returnData.return.length;
                minPrice = calculateMinPrice(flights);
            }
            else if (tripType === 'MULTI_CITY') {
                const legs = flightDataResult.data as { legNumber: number; legKey: string; flights: TransformedFlight[] }[];
                flights = legs.flatMap(leg => leg.flights);
                flightCount = flights.length;
                minPrice = calculateMinPrice(flights);
            }

            return {
                date: formatDate(date),
                success: true,
                flightData: flightDataResult,
                flightDataResult, // Keep the original structured data
                rawData: data,
                flightCount: flightCount,
                minPrice: minPrice
            };
        } catch (error: any) {
            console.error(`Failed to fetch flights for date ${formatDate(date)}:`, error);
            return {
                date: formatDate(date),
                success: false,
                flightData: null,
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
                flightData: null,
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

const calculateMinPrice = (flights: TransformedFlight[]): number | null => {
    if (!flights || flights.length === 0) return null;

    // Extract all net fares from all fare options of all flights
    const allPrices: number[] = [];

    flights.forEach(flight => {
        flight.fareOptions.forEach(fareOption => {
            if (fareOption.netFare && fareOption.netFare > 0) {
                allPrices.push(fareOption.netFare);
            }
        });
    });

    if (allPrices.length === 0) return null;
    return Math.min(...allPrices);
};