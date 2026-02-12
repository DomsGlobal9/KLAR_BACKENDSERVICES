import { PrimarySortType, SecondarySortType, SortOptions } from "../../interface/flight/sort.interface";
import { TripType } from "../tripTypeDetector";
import { sortOneWayFlights, sortReturnFlights, sortMultiCityFlights } from "./flightSort";

export * from "./flightSort";


export class FlightSorter {
    /**
     * Sort flights based on trip type and sort options
     */
    static sort(
        flightData: any,
        tripType: TripType,
        options: SortOptions
    ): any {
        if (!flightData) return flightData;

        switch (tripType) {
            case 'ONE_WAY':
                return sortOneWayFlights(flightData as any[], options);

            case 'RETURN':
                return sortReturnFlights(flightData as any[], options);

            case 'MULTI_CITY':
                return sortMultiCityFlights(flightData as any[], options);

            default:
                return flightData;
        }
    }

    /**
     * Get default sort options
     */
    static getDefaultOptions(): SortOptions {
        return {
            primary: 'CHEAPEST',
            secondary: 'NONE'
        };
    }

    /**
     * Validate sort options
     */
    static validateOptions(options: any): SortOptions {
        const validPrimary: PrimarySortType[] = ['CHEAPEST', 'QUICKEST'];
        const validSecondary: SecondarySortType[] = ['EARLY_DEPARTURE', 'EARLY_ARRIVAL', 'NONE'];

        return {
            primary: validPrimary.includes(options?.primary) ? options.primary : 'CHEAPEST',
            secondary: validSecondary.includes(options?.secondary) ? options.secondary : 'NONE'
        };
    }
}