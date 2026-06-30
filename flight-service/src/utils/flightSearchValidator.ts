import {
    SearchQuery,
    ValidationResult,
    ValidationError,
    SearchType,
    CabinClass,
    PreferredAirline,
    RouteInfo
} from '../types/flightSearch.types';

import {
    CABIN_CLASSES,
    FARE_TYPES,
    ERROR_CODES,
    MAX_PASSENGERS,
    MIN_ADULT,
    MAX_ROUTE_INFOS,
    MAX_PREFERRED_AIRLINES,
    AIRPORT_CODE_REGEX,
    DATE_REGEX
} from '../constants/flightConstants';

export class FlightSearchValidator {

    /**
     * Main validation method for flight search
     */
    static validate(searchQuery: SearchQuery): ValidationResult {

        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        this.validateCabinClass(searchQuery.cabinClass, errors);

        this.validatePaxInfo(searchQuery.paxInfo, errors, warnings);

        const searchType = this.validateRouteInfos(
            searchQuery.routeInfos,
            errors,
            warnings
        );

        if (searchQuery.preferredAirline) {
            this.validatePreferredAirlines(searchQuery.preferredAirline, errors);
        }

        if (searchQuery.searchModifiers) {
            this.validateSearchModifiers(
                searchQuery.searchModifiers,
                searchQuery.paxInfo,
                errors
            );
        }

        return {
            isValid: errors.length === 0,
            errors,
            searchType,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }

    /**
     * Validate cabin class
     */
    private static validateCabinClass(
        cabinClass: CabinClass,
        errors: ValidationError[]
    ): void {
        if (!cabinClass) {
            errors.push({
                field: 'searchQuery.cabinClass',
                message: 'Cabin class is required',
                code: ERROR_CODES.INVALID_CABIN_CLASS
            });
            return;
        }

        if (!CABIN_CLASSES.includes(cabinClass)) {
            errors.push({
                field: 'searchQuery.cabinClass',
                message: `Invalid cabin class. Must be one of: ${CABIN_CLASSES.join(', ')}`,
                code: ERROR_CODES.INVALID_CABIN_CLASS
            });
        }
    }

    /**
     * Validate passenger information
     */
    private static validatePaxInfo(
        paxInfo: SearchQuery['paxInfo'],
        errors: ValidationError[],
        warnings: ValidationError[]
    ): void {
        if (!paxInfo) {
            errors.push({
                field: 'searchQuery.paxInfo',
                message: 'Passenger information is required',
                code: ERROR_CODES.INVALID_ADULT_COUNT
            });
            return;
        }

        const adult = paxInfo.ADULT || 0;
        const child = paxInfo.CHILD || 0;
        const infant = paxInfo.INFANT || 0;

        if (adult < MIN_ADULT) {
            errors.push({
                field: 'searchQuery.paxInfo.ADULT',
                message: `At least ${MIN_ADULT} adult is required`,
                code: ERROR_CODES.INVALID_ADULT_COUNT
            });
        }

        if (adult > MAX_PASSENGERS) {
            errors.push({
                field: 'searchQuery.paxInfo.ADULT',
                message: `Adult count cannot exceed ${MAX_PASSENGERS}`,
                code: ERROR_CODES.MAX_PASSENGER_EXCEEDED
            });
        }

        if (child < 0) {
            errors.push({
                field: 'searchQuery.paxInfo.CHILD',
                message: 'Child count cannot be negative',
                code: ERROR_CODES.INVALID_CHILD_COUNT
            });
        }

        if (infant < 0) {
            errors.push({
                field: 'searchQuery.paxInfo.INFANT',
                message: 'Infant count cannot be negative',
                code: ERROR_CODES.INVALID_INFANT_COUNT
            });
        }

        const totalPassengers = adult + child;
        if (totalPassengers > MAX_PASSENGERS) {
            errors.push({
                field: 'searchQuery.paxInfo',
                message: `Total passengers (adults + children) cannot exceed ${MAX_PASSENGERS}`,
                code: ERROR_CODES.MAX_PASSENGER_EXCEEDED
            });
        }

        if (infant > adult) {
            errors.push({
                field: 'searchQuery.paxInfo.INFANT',
                message: 'Number of infants cannot exceed number of adults',
                code: ERROR_CODES.INFANT_MORE_THAN_ADULT
            });
        }

        if (totalPassengers >= 7) {
            warnings.push({
                field: 'searchQuery.paxInfo',
                message: 'Large group booking. Consider contacting support for better fares.',
                code: 'LARGE_GROUP_WARNING'
            });
        }
    }

    /**
     * Validate route infos and determine search type
     */
    private static validateRouteInfos(
        routeInfos: RouteInfo[],
        errors: ValidationError[],
        warnings: ValidationError[]
    ): SearchType | undefined {
        if (!routeInfos || routeInfos.length === 0) {
            errors.push({
                field: 'searchQuery.routeInfos',
                message: 'At least one route info is required',
                code: ERROR_CODES.EMPTY_ROUTE_INFOS
            });
            return undefined;
        }

        if (routeInfos.length > MAX_ROUTE_INFOS) {
            errors.push({
                field: 'searchQuery.routeInfos',
                message: `Maximum ${MAX_ROUTE_INFOS} route infos allowed for multi-city`,
                code: ERROR_CODES.INVALID_ROUTE_COUNT
            });
            return undefined;
        }

        let searchType: SearchType;

        if (routeInfos.length === 1) {
            searchType = 'ONEWAY';
        }
        else if (
            routeInfos.length === 2 &&
            routeInfos[0].fromCityOrAirport?.code === routeInfos[1].toCityOrAirport?.code &&
            routeInfos[0].toCityOrAirport?.code === routeInfos[1].fromCityOrAirport?.code
        ) {
            searchType = 'RETURN';
        }
        else {
            searchType = 'MULTICITY';
        }

        const travelDates: string[] = [];

        for (let i = 0; i < routeInfos.length; i++) {
            const route = routeInfos[i];
            const prefix = `searchQuery.routeInfos[${i}]`;

            if (!route.fromCityOrAirport?.code) {
                errors.push({
                    field: `${prefix}.fromCityOrAirport.code`,
                    message: 'Origin airport code is required',
                    code: ERROR_CODES.INVALID_AIRPORT_CODE
                });
            } else if (!AIRPORT_CODE_REGEX.test(route.fromCityOrAirport.code)) {
                errors.push({
                    field: `${prefix}.fromCityOrAirport.code`,
                    message: `Invalid origin airport code: ${route.fromCityOrAirport.code}. Must be 3 uppercase letters`,
                    code: ERROR_CODES.INVALID_AIRPORT_CODE
                });
            }

            if (!route.toCityOrAirport?.code) {
                errors.push({
                    field: `${prefix}.toCityOrAirport.code`,
                    message: 'Destination airport code is required',
                    code: ERROR_CODES.INVALID_AIRPORT_CODE
                });
            } else if (!AIRPORT_CODE_REGEX.test(route.toCityOrAirport.code)) {
                errors.push({
                    field: `${prefix}.toCityOrAirport.code`,
                    message: `Invalid destination airport code: ${route.toCityOrAirport.code}. Must be 3 uppercase letters`,
                    code: ERROR_CODES.INVALID_AIRPORT_CODE
                });
            }

            if (route.fromCityOrAirport?.code && route.toCityOrAirport?.code &&
                route.fromCityOrAirport.code === route.toCityOrAirport.code) {
                errors.push({
                    field: `${prefix}`,
                    message: 'Origin and destination airports cannot be the same',
                    code: ERROR_CODES.SAME_ORIGIN_DESTINATION
                });
            }

            this.validateTravelDate(route.travelDate, prefix, errors);

            if (route.travelDate) {
                travelDates.push(route.travelDate);
            }
        }

        if (searchType === 'RETURN' && travelDates.length === 2) {
            const onward = new Date(travelDates[0]);
            const ret = new Date(travelDates[1]);

            onward.setHours(0, 0, 0, 0);
            ret.setHours(0, 0, 0, 0);

            if (ret < onward) {
                errors.push({
                    field: 'searchQuery.routeInfos[1].travelDate',
                    message: 'Return travel date cannot be before onward travel date',
                    code: ERROR_CODES.DATE_NOT_ASCENDING
                });
            }
        } else if (searchType === 'MULTICITY' && travelDates.length > 1) {

            for (let i = 1; i < routeInfos.length; i++) {

                const prevRoute = routeInfos[i - 1];
                const currentRoute = routeInfos[i];

                const prevDate = new Date(prevRoute.travelDate);
                const currDate = new Date(currentRoute.travelDate);

                prevDate.setHours(0, 0, 0, 0);
                currDate.setHours(0, 0, 0, 0);

                if (currDate < prevDate) {
                    errors.push({
                        field: `searchQuery.routeInfos[${i}].travelDate`,
                        message: `Travel date cannot be before previous segment date`,
                        code: ERROR_CODES.DATE_NOT_ASCENDING
                    });
                    break;
                }

                const isReverseRoute =
                    prevRoute.fromCityOrAirport?.code === currentRoute.toCityOrAirport?.code &&
                    prevRoute.toCityOrAirport?.code === currentRoute.fromCityOrAirport?.code;

                if (isReverseRoute) {
                    errors.push({
                        field: `searchQuery.routeInfos[${i}]`,
                        message: `Reverse route is not allowed in multicity journey`,
                        code: ERROR_CODES.INVALID_ROUTE_SEQUENCE
                    });
                    break;
                }
            }
        }

        if (searchType === 'MULTICITY' && routeInfos.length >= 3) {
            warnings.push({
                field: 'searchQuery.routeInfos',
                message: 'Multi-city booking with 3+ segments may have limited availability',
                code: 'MULTICITY_COMPLEX_WARNING'
            });
        }

        return searchType;
    }

    /**
     * Validate travel date
     */
    private static validateTravelDate(
        travelDate: string,
        fieldPrefix: string,
        errors: ValidationError[]
    ): void {
        if (!travelDate) {
            errors.push({
                field: `${fieldPrefix}.travelDate`,
                message: 'Travel date is required',
                code: ERROR_CODES.INVALID_TRAVEL_DATE
            });
            return;
        }

        if (!DATE_REGEX.test(travelDate)) {
            errors.push({
                field: `${fieldPrefix}.travelDate`,
                message: 'Invalid date format. Use YYYY-MM-DD',
                code: ERROR_CODES.INVALID_DATE_FORMAT
            });
            return;
        }

        const date = new Date(travelDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(date.getTime())) {
            errors.push({
                field: `${fieldPrefix}.travelDate`,
                message: 'Invalid date',
                code: ERROR_CODES.INVALID_TRAVEL_DATE
            });
            return;
        }

        if (date < today) {
            errors.push({
                field: `${fieldPrefix}.travelDate`,
                message: 'Travel date cannot be in the past',
                code: ERROR_CODES.INVALID_TRAVEL_DATE
            });
        }

        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        if (date > nextYear) {
            errors.push({
                field: `${fieldPrefix}.travelDate`,
                message: 'Travel date cannot be more than 1 year from today',
                code: ERROR_CODES.DATE_TOO_FAR
            });
        }
    }

    /**
     * Validate preferred airlines
     */
    private static validatePreferredAirlines(
        preferredAirlines: PreferredAirline[],
        errors: ValidationError[]
    ): void {
        if (preferredAirlines.length > MAX_PREFERRED_AIRLINES) {
            errors.push({
                field: 'searchQuery.preferredAirline',
                message: `Maximum ${MAX_PREFERRED_AIRLINES} preferred airlines allowed`,
                code: ERROR_CODES.PREFERRED_AIRLINE_LIMIT
            });
        }

        for (let i = 0; i < preferredAirlines.length; i++) {
            const airline = preferredAirlines[i];
            if (!airline.code) {
                errors.push({
                    field: `searchQuery.preferredAirline[${i}].code`,
                    message: 'Airline code is required',
                    code: ERROR_CODES.INVALID_AIRPORT_CODE
                });
            } else if (!AIRPORT_CODE_REGEX.test(airline.code)) {
                errors.push({
                    field: `searchQuery.preferredAirline[${i}].code`,
                    message: `Invalid airline code: ${airline.code}. Must be 2-3 uppercase letters`,
                    code: ERROR_CODES.INVALID_AIRPORT_CODE
                });
            }
        }
    }

    /**
     * Validate search modifiers
     */
    private static validateSearchModifiers(
        modifiers: SearchQuery['searchModifiers'],
        paxInfo: SearchQuery['paxInfo'],
        errors: ValidationError[]
    ): void {
        if (!modifiers) return;

        if (modifiers.isDirectFlight === false && modifiers.isConnectingFlight === false) {
            errors.push({
                field: 'searchQuery.searchModifiers',
                message: 'At least one of isDirectFlight or isConnectingFlight must be true',
                code: 'INVALID_FLIGHT_FILTERS'
            });
        }

        if (modifiers.pft && !FARE_TYPES.includes(modifiers.pft)) {
            errors.push({
                field: 'searchQuery.searchModifiers.pft',
                message: `Invalid fare type. Must be one of: ${FARE_TYPES.join(', ')}`,
                code: ERROR_CODES.INVALID_FARE_TYPE
            });
        }

        if (modifiers.pft === 'STUDENT' || modifiers.pft === 'SENIOR_CITIZEN') {
            const child = paxInfo?.CHILD || 0;
            const infant = paxInfo?.INFANT || 0;

            if (child > 0 || infant > 0) {
                errors.push({
                    field: 'searchQuery.paxInfo',
                    message: `${modifiers.pft} fare is only applicable for ADULT passengers. Child and Infant not allowed`,
                    code: ERROR_CODES.CHILD_OR_INFANT_WITH_SPECIAL_FARE
                });
            }
        }
    }

    /**
     * Helper method to quickly check if search is valid
     */
    static isValid(searchQuery: SearchQuery): boolean {
        return this.validate(searchQuery).isValid;
    }

    /**
     * Helper method to get only error messages
     */
    static getErrorMessages(searchQuery: SearchQuery): string[] {
        const result = this.validate(searchQuery);
        return result.errors.map(err => err.message);
    }
}


export default FlightSearchValidator;