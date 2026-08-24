import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { TRIPJACK_URLS } from "../config";
import { SortOption } from "../types/sort.types";
import tripjackConfig from "../config/tripjack.config";
import RedisCacheService from "../cache/redisCache.service";
import { Filter, FilterStats } from "../types/filter.types";
import { FlightFilter } from "../utils/sorter/filter.utils";
import { FlightSegment } from "../types/returnFilter.types";
import MarkupInterceptor from "../services/markup.interceptor";
import { OneWayNormalizer } from "../normalizers/oneway.normalizer";
import { ReturnNormalizer } from "../normalizers/return.normalizer";
import { OnewayFlightSorter } from "../utils/sorter/onewaySort.utils";
import { ReturnFlightSorter } from "../utils/sorter/returnSort.utils";
import { MulticityFlightSorter } from "../utils/sorter/multiSort.utils";
import { MultiCityFlightFilter } from "../utils/sorter/multiFilter.utils";
import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";
import { logFlightEvent, mapWithConcurrency } from "../utils/flightLog.util";
import { OnewayFlightListPdfService } from "./onewayFlightListPdf.service";
import { ReturnFlightListPdfService } from "./returnFlightListPdf.service";
import { MultiCityFlightListPdfService } from "./multicityFlightListPdf.service";

class SearchService {

    private static readonly FARE_RULE_CONCURRENCY = 5;
    private static readonly FARE_RULE_TIMEOUT_MS = 15000;

    async searchOneWay(
        payload: any,
        sortOption?: SortOption,
        filters?: Filter[],
        includeStats: boolean = false,
        printData: boolean | string = false
    ) {
        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        // ── Route-level cache: skip TripJack if we already have this route ──
        if (!printData) {
            const routeKey = this.buildRouteKey(payload);
            if (routeKey) {
                const cached = await RedisCacheService.get(routeKey);
                if (cached?.raw) {
                    console.log(`[SearchService] Cache HIT for key: ${routeKey}`);
                    const fakeMarkedUp = { searchResult: { tripInfos: cached.raw } };
                    const normalizedResult = OneWayNormalizer.transform({ data: fakeMarkedUp });

                    let normalized = normalizedResult.flights;
                    const airlineStats = normalizedResult.airlineStats;
                    const originalCount = normalized.length;

                    if (filters && filters.length > 0) {
                        const validation = FlightFilter.validateFilters(filters);
                        if (validation.isValid) {
                            normalized = FlightFilter.applyFilters(normalized, filters);
                        }
                    }
                    if (sortOption && OnewayFlightSorter.isValidSortField(sortOption.field)) {
                        normalized = OnewayFlightSorter.sortFlights(normalized, sortOption);
                    }
                    // Store new session pointing to same raw data
                    await RedisCacheService.set(sessionId, { raw: cached.raw }, 1800);

                    const response: any = { sessionId, flights: normalized, airlineStats, fromCache: true };
                    if (includeStats) {
                        const stats = FlightFilter.getFilterStats(normalized);
                        stats.totalFlights = originalCount;
                        stats.filteredFlights = normalized.length;
                        response.stats = stats;
                    }
                    return response;
                }
            }
        }

        try {
            const tripjackPayload = this.prepareTripjackSearchPayload(payload);
            const rawResponse = await axios.post(
                url,
                { searchQuery: tripjackPayload },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                }
            );

            require('fs').writeFileSync('tripjack_raw.json', JSON.stringify(rawResponse.data, null, 2));
            if (rawResponse.data && rawResponse.data.status && rawResponse.data.status.success === false) {
                throw new Error("TripJack API Error: " + JSON.stringify(rawResponse.data.errors));
            }
            if (rawResponse.data && rawResponse.data.status && rawResponse.data.status.success === false) {
                throw new Error("TripJack API Error: " + JSON.stringify(rawResponse.data.errors));
            }
            const markedUpResponse = MarkupInterceptor.applyMarkupToFlightSearch(rawResponse.data);

            if (printData == "true" || printData == true) {

                let normalized = OneWayNormalizer.transformWithAllFares({
                    data: markedUpResponse
                });

                const originalCount = normalized.length;


                if (filters && filters.length > 0) {
                    const validation = FlightFilter.validateFilters(filters);
                    if (validation.isValid) {
                        normalized = FlightFilter.applyFilters(normalized, filters);
                    } else {

                    }
                }


                if (sortOption && OnewayFlightSorter.isValidSortField(sortOption.field)) {
                    normalized = OnewayFlightSorter.sortFlights(normalized, sortOption);
                }


                let stats: FilterStats | undefined;
                if (includeStats) {
                    stats = FlightFilter.getFilterStats(normalized);
                    stats.totalFlights = originalCount;
                    stats.filteredFlights = normalized.length;
                }


                const flightData = {
                    flights: normalized,
                    searchParams: payload,
                    filtersApplied: filters,
                    sortApplied: sortOption,
                    totalFlights: normalized.length,
                    generatedAt: new Date().toISOString()
                };

                // if (stats) {
                //     flightData.stats = stats;
                // }


                const pdfBuffer = await OnewayFlightListPdfService.generateFlightDetailsPDF(flightData);

                return {
                    pdfBuffer,
                    isPdf: true
                };
            }

            const normalizedResult = OneWayNormalizer.transform({ data: markedUpResponse });

            let normalized = normalizedResult.flights;
            if (payload?.searchModifiers?.isConnectingFlight === false) {
                normalized = normalized.filter((f: any) => f.stops === 0);
            }
            const airlineStats = normalizedResult.airlineStats;

            const originalCount = normalized.length;

            if (filters && filters.length > 0) {
                const validation = FlightFilter.validateFilters(filters);
                if (validation.isValid) {
                    normalized = FlightFilter.applyFilters(normalized, filters);
                } else {

                }
            }

            if (sortOption && OnewayFlightSorter.isValidSortField(sortOption.field)) {
                normalized = OnewayFlightSorter.sortFlights(normalized, sortOption);
            }

            let stats: FilterStats | undefined;
            if (includeStats) {
                stats = FlightFilter.getFilterStats(normalized);
                stats.totalFlights = originalCount;
                stats.filteredFlights = normalized.length;
            }

            // Store by session id (for fare/details lookup)
            await RedisCacheService.set(sessionId, {
                raw: markedUpResponse?.searchResult?.tripInfos,
                searchQuery: payload,
            }, 1800);

            // Also store by route key (for repeated search cache hit)
            const routeKey = this.buildRouteKey(payload);
            if (routeKey) {
                await RedisCacheService.set(routeKey, {
                    raw: markedUpResponse?.searchResult?.tripInfos,
                }, 1200); // 20-minute TTL — flights don't change that fast
            }

            const response: any = {
                sessionId,
                flights: normalized,
                airlineStats
            };

            if (stats) {
                response.stats = stats;
            }

            return response;

        } catch (error: any) {
            console.error("OneWay Search ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }


    async searchReturn(
        payload: any,
        sortOption?: SortOption,
        sortTarget: 'onward' | 'return' | 'both' = 'both',
        filters?: Filter[],
        filterTarget: 'onward' | 'return' | 'both' = 'both',
        includeStats: boolean = false,
        printData: boolean | string = false,
    ) {
        const sessionId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        try {
            const tripjackPayload = this.prepareTripjackSearchPayload(payload);
            const rawResponse = await axios.post(
                url,
                { searchQuery: tripjackPayload },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                }
            );

            if (printData == "true" || printData == true) {

                const normalizedWithAllFares = ReturnNormalizer.transformWithAllFares(rawResponse);

                let result: any;


                if (normalizedWithAllFares.type === 'domestic') {
                    let onward = normalizedWithAllFares.onward || [];
                    let returnFlights = normalizedWithAllFares.return || [];

                    const originalOnwardCount = onward.length;
                    const originalReturnCount = returnFlights.length;


                    if (filters && filters.length > 0) {
                        const validation = FlightFilter.validateFilters(filters);
                        if (validation.isValid) {
                            if (filterTarget === 'onward' || filterTarget === 'both') {
                                onward = FlightFilter.applyFilters(onward, filters);
                            }
                            if (filterTarget === 'return' || filterTarget === 'both') {
                                returnFlights = FlightFilter.applyFilters(returnFlights, filters);
                            }
                        } else {

                        }
                    }


                    if (sortOption && ReturnFlightSorter.isValidSortField(sortOption.field)) {
                        if (sortTarget === 'onward' || sortTarget === 'both') {
                            onward = ReturnFlightSorter.sortFlights(onward, sortOption);
                        }
                        if (sortTarget === 'return' || sortTarget === 'both') {
                            returnFlights = ReturnFlightSorter.sortFlights(returnFlights, sortOption);
                        }
                    }

                    result = {
                        onward,
                        return: returnFlights,
                        type: 'domestic'
                    };


                    if (includeStats) {
                        result.stats = {
                            onward: FlightFilter.getFilterStats(onward),
                            return: FlightFilter.getFilterStats(returnFlights)
                        };
                        result.stats.onward.totalFlights = originalOnwardCount;
                        result.stats.return.totalFlights = originalReturnCount;
                    }
                }


                else if (normalizedWithAllFares.type === 'international') {
                    let roundTrips = normalizedWithAllFares.roundTrips || [];
                    const originalCount = roundTrips.length;


                    if (filters && filters.length > 0) {
                        const validation = FlightFilter.validateFilters(filters);
                        if (validation.isValid) {
                            roundTrips = roundTrips.filter((rt: any) => {
                                let onwardMatch = true;
                                let returnMatch = true;

                                if (filterTarget === 'onward' || filterTarget === 'both') {
                                    onwardMatch = FlightFilter.applyFilters([rt.onward], filters).length > 0;
                                }
                                if (filterTarget === 'return' || filterTarget === 'both') {
                                    returnMatch = FlightFilter.applyFilters([rt.return], filters).length > 0;
                                }

                                return onwardMatch && returnMatch;
                            });
                        } else {

                        }
                    }


                    if (sortOption && ReturnFlightSorter.isValidSortField(sortOption.field)) {
                        if (sortTarget === 'onward' || sortTarget === 'both') {
                            roundTrips.sort((a: any, b: any) => {
                                let comparison = 0;
                                const field = sortOption.field;
                                const order = sortOption.order;

                                if (field === 'price') {
                                    comparison = a.totalPrice - b.totalPrice;
                                } else if (field === 'departureTime') {
                                    const timeA = a.onward.from.time;
                                    const timeB = b.onward.from.time;
                                    comparison = timeA.localeCompare(timeB);
                                } else if (field === 'arrivalTime') {
                                    const timeA = a.onward.to.time;
                                    const timeB = b.onward.to.time;
                                    comparison = timeA.localeCompare(timeB);
                                } else if (field === 'duration') {
                                    const durA = parseInt(a.onward.duration);
                                    const durB = parseInt(b.onward.duration);
                                    comparison = durA - durB;
                                } else if (field === 'stops') {
                                    comparison = a.onward.stops - b.onward.stops;
                                }

                                return order === 'asc' ? comparison : -comparison;
                            });
                        }

                        if (sortTarget === 'return' || sortTarget === 'both') {
                            roundTrips.sort((a: any, b: any) => {
                                let comparison = 0;
                                const field = sortOption.field;
                                const order = sortOption.order;

                                if (field === 'price') {
                                    comparison = a.totalPrice - b.totalPrice;
                                } else if (field === 'departureTime') {
                                    const timeA = a.return.from.time;
                                    const timeB = b.return.from.time;
                                    comparison = timeA.localeCompare(timeB);
                                } else if (field === 'arrivalTime') {
                                    const timeA = a.return.to.time;
                                    const timeB = b.return.to.time;
                                    comparison = timeA.localeCompare(timeB);
                                } else if (field === 'duration') {
                                    const durA = parseInt(a.return.duration);
                                    const durB = parseInt(b.return.duration);
                                    comparison = durA - durB;
                                } else if (field === 'stops') {
                                    comparison = a.return.stops - b.return.stops;
                                }

                                return order === 'asc' ? comparison : -comparison;
                            });
                        }
                    }

                    result = {
                        roundTrips,
                        type: 'international'
                    };


                    if (includeStats) {
                        const onwardFlights = roundTrips.map((rt: any) => rt.onward);
                        const returnFlights = roundTrips.map((rt: any) => rt.return);
                        result.stats = {
                            onward: FlightFilter.getFilterStats(onwardFlights),
                            return: FlightFilter.getFilterStats(returnFlights)
                        };
                        result.stats.onward.totalFlights = originalCount;
                        result.stats.return.totalFlights = originalCount;
                    }
                }

                const pdfData = {
                    ...result,
                    searchParams: {
                        origin: payload.origin,
                        destination: payload.destination,
                        departureDate: payload.departureDate,
                        returnDate: payload.returnDate,
                        passengerCount: payload.passengerCount
                    },
                    filtersApplied: filters,
                    sortApplied: sortOption,
                    generatedAt: new Date().toISOString()
                };

                const pdfBuffer = await ReturnFlightListPdfService.generateReturnFlightDetailsPDF(pdfData);

                return {
                    pdfBuffer,
                    isPdf: true
                };
            }

            const normalizedResult = ReturnNormalizer.transform(rawResponse);

            const airlineStats = normalizedResult.airlineStats;

            let normalized: any;

            if ('roundTrips' in normalizedResult) {
                normalized = {
                    roundTrips: normalizedResult.roundTrips
                };
            } else {
                normalized = {
                    onward: normalizedResult.onward,
                    return: normalizedResult.return
                };
            }

            const isDomestic = 'onward' in normalized && 'return' in normalized;
            const isInternational = 'roundTrips' in normalized;

            if (payload?.searchModifiers?.isConnectingFlight === false) {
                if (isDomestic) {
                    normalized.onward = (normalized.onward || []).filter((f: any) => f.stops === 0);
                    normalized.return = (normalized.return || []).filter((f: any) => f.stops === 0);
                } else if (isInternational) {
                    normalized.roundTrips = (normalized.roundTrips || []).filter((rt: any) => (rt.onward?.stops ?? 0) === 0 && (rt.return?.stops ?? 0) === 0);
                }
            }

            let originalOnwardCount = 0;
            let originalReturnCount = 0;

            if (isDomestic) {
                originalOnwardCount = normalized.onward.length;
                originalReturnCount = normalized.return.length;
            }

            if (filters && filters.length > 0) {
                const validation = FlightFilter.validateFilters(filters);
                if (validation.isValid) {
                    if (isDomestic) {
                        normalized = FlightFilter.applyFiltersToReturnFlights(
                            normalized as { onward: FlightSegment[]; return: FlightSegment[] },
                            filters,
                            filterTarget
                        );
                    } else if (isInternational) {
                        const roundTrips = (normalized as { roundTrips: any[] }).roundTrips;
                        const filteredRoundTrips = roundTrips.filter(rt => {
                            let onwardMatch = true;
                            let returnMatch = true;

                            if (filterTarget === 'onward' || filterTarget === 'both') {
                                onwardMatch = FlightFilter.applyFilters([rt.onward], filters).length > 0;
                            }
                            if (filterTarget === 'return' || filterTarget === 'both') {
                                returnMatch = FlightFilter.applyFilters([rt.return], filters).length > 0;
                            }

                            return onwardMatch && returnMatch;
                        });
                        normalized = { roundTrips: filteredRoundTrips };
                    }
                } else {

                }
            }

            if (sortOption && ReturnFlightSorter.isValidSortField(sortOption.field)) {
                if (isDomestic) {
                    normalized = ReturnFlightSorter.sortReturnFlights(
                        normalized as { onward: FlightSegment[]; return: FlightSegment[] },
                        sortOption,
                        sortTarget
                    );
                } else if (isInternational) {
                    const roundTrips = (normalized as { roundTrips: any[] }).roundTrips;
                    let sortedRoundTrips = [...roundTrips];

                    if (sortTarget === 'onward' || sortTarget === 'both') {
                        sortedRoundTrips.sort((a, b) => {
                            let comparison = 0;
                            const field = sortOption.field;
                            const order = sortOption.order;

                            if (field === 'price') {
                                comparison = a.totalPrice - b.totalPrice;
                            } else if (field === 'departureTime') {
                                const timeA = a.onward.from.time;
                                const timeB = b.onward.from.time;
                                comparison = timeA.localeCompare(timeB);
                            } else if (field === 'arrivalTime') {
                                const timeA = a.onward.to.time;
                                const timeB = b.onward.to.time;
                                comparison = timeA.localeCompare(timeB);
                            } else if (field === 'duration') {
                                const durA = parseInt(a.onward.duration);
                                const durB = parseInt(b.onward.duration);
                                comparison = durA - durB;
                            } else if (field === 'stops') {
                                comparison = a.onward.stops - b.onward.stops;
                            }

                            return order === 'asc' ? comparison : -comparison;
                        });
                    }

                    if (sortTarget === 'return' || sortTarget === 'both') {
                        sortedRoundTrips.sort((a, b) => {
                            let comparison = 0;
                            const field = sortOption.field;
                            const order = sortOption.order;

                            if (field === 'price') {
                                comparison = a.totalPrice - b.totalPrice;
                            } else if (field === 'departureTime') {
                                const timeA = a.return.from.time;
                                const timeB = b.return.from.time;
                                comparison = timeA.localeCompare(timeB);
                            } else if (field === 'arrivalTime') {
                                const timeA = a.return.to.time;
                                const timeB = b.return.to.time;
                                comparison = timeA.localeCompare(timeB);
                            } else if (field === 'duration') {
                                const durA = parseInt(a.return.duration);
                                const durB = parseInt(b.return.duration);
                                comparison = durA - durB;
                            } else if (field === 'stops') {
                                comparison = a.return.stops - b.return.stops;
                            }

                            return order === 'asc' ? comparison : -comparison;
                        });
                    }

                    normalized = { roundTrips: sortedRoundTrips };
                }
            }

            let stats: any = undefined;
            if (includeStats) {
                if (isDomestic) {
                    stats = {
                        onward: FlightFilter.getFilterStats((normalized as { onward: FlightSegment[] }).onward),
                        return: FlightFilter.getFilterStats((normalized as { return: FlightSegment[] }).return)
                    };
                    stats.onward.totalFlights = originalOnwardCount;
                    stats.return.totalFlights = originalReturnCount;
                } else if (isInternational) {
                    const roundTrips = (normalized as { roundTrips: any[] }).roundTrips;
                    const onwardFlights = roundTrips.map(rt => rt.onward);
                    const returnFlights = roundTrips.map(rt => rt.return);
                    stats = {
                        onward: FlightFilter.getFilterStats(onwardFlights),
                        return: FlightFilter.getFilterStats(returnFlights)
                    };
                }
            }

            await RedisCacheService.set(sessionId, {
                raw: rawResponse?.data?.searchResult?.tripInfos,
                searchQuery: payload,
            }, 1800);

            const response: any = {
                sessionId,
                flights: normalized,
                airlineStats
            };

            if (stats) {
                response.stats = stats;
            }

            return response;

        } catch (error: any) {
            console.error("Return Search ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    async searchMulticity(
        payload: any,
        sortOption?: SortOption,
        legIndex?: number,
        filters?: Filter[],
        applyToLegs?: number[] | 'all',
        includeStats: boolean = false,
        includeFareRules: boolean = false,
        printData: boolean | string = false,
    ) {
        const sessionId = uuidv4();
        const requestId = uuidv4();

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        logFlightEvent("SEARCH_REQUEST", {
            requestId,
            sessionId,
            searchType: "MULTICITY",
            endpoint: config.SEARCH,
            routeInfos: MultiCityNormalizer.buildRoutes(payload)
        });

        try {
            const tripjackPayload = this.prepareTripjackSearchPayload(payload);
            const rawResponse = await axios.post(
                url,
                { searchQuery: tripjackPayload },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                }
            );

            if (rawResponse.data && rawResponse.data.status && rawResponse.data.status.success === false) {
                throw new Error("TripJack API Error: " + JSON.stringify(rawResponse.data.errors));
            }

            if (printData == "true" || printData == true) {

                const normalizedWithAllFares = MultiCityNormalizer.transformWithAllFares(rawResponse.data, payload);

                let result: any;

                
                if (normalizedWithAllFares.type === 'domestic') {
                    let legs = normalizedWithAllFares.flights || [];

                    
                    const originalCounts = legs.map((leg: any) => ({
                        legIndex: leg.legIndex,
                        count: leg.flights.length
                    }));

                    
                    if (filters && filters.length > 0) {
                        const validation = MultiCityFlightFilter.validateFilters(filters);
                        if (validation.isValid) {
                            legs = MultiCityFlightFilter.applyFiltersToMultiCityFlights(
                                legs,
                                filters,
                                applyToLegs || 'all'
                            );
                        } else {

                        }
                    }

                    
                    if (sortOption && MulticityFlightSorter.isValidSortField(sortOption.field)) {
                        if (legIndex !== undefined && MulticityFlightSorter.isValidLegIndex(legIndex, legs.length)) {
                            legs = MulticityFlightSorter.sortSpecificLeg(legs, sortOption, legIndex);
                        } else if (legIndex === undefined) {
                            legs = MulticityFlightSorter.sortMultiCityFlights(legs, sortOption);
                        }
                    }

                    result = {
                        legs,
                        type: 'domestic'
                    };

                    
                    if (includeStats) {
                        result.stats = MultiCityFlightFilter.getMultiCityFilterStats(legs);
                        originalCounts.forEach((original: { legIndex: number; count: number }) => {
                            if (result.stats[original.legIndex]) {
                                result.stats[original.legIndex].totalFlights = original.count;
                                result.stats[original.legIndex].filteredFlights = legs[original.legIndex]?.flights.length || 0;
                            }
                        });
                    }
                }

                
                else if (normalizedWithAllFares.type === 'international') {
                    let itineraries = normalizedWithAllFares.flights || [];
                    const originalCount = itineraries.length;

                    
                    if (filters && filters.length > 0) {
                        const validation = MultiCityFlightFilter.validateFilters(filters);
                        if (validation.isValid) {
                            const legsToFilter = applyToLegs === 'all'
                                ? (itineraries[0]?.legs?.map((_: any, idx: number) => idx) || [])
                                : applyToLegs || [];

                            itineraries = itineraries.filter((itinerary: any) => {
                                let allLegsMatch = true;
                                for (const legIdx of legsToFilter) {
                                    if (legIdx < itinerary.legs.length) {
                                        const legMatch = MultiCityFlightFilter.applyFilters([itinerary.legs[legIdx]], filters).length > 0;
                                        if (!legMatch) {
                                            allLegsMatch = false;
                                            break;
                                        }
                                    }
                                }
                                return allLegsMatch;
                            });
                        } else {

                        }
                    }

                    
                    if (sortOption && MulticityFlightSorter.isValidSortField(sortOption.field)) {
                        if (sortOption.field === 'price') {
                            itineraries.sort((a: any, b: any) => {
                                const comparison = a.totalPrice - b.totalPrice;
                                return sortOption.order === 'asc' ? comparison : -comparison;
                            });
                        }
                    }

                    result = {
                        itineraries,
                        type: 'international'
                    };

                    
                    if (includeStats) {
                        result.stats = {
                            totalItineraries: itineraries.length,
                            originalCount: originalCount,
                            priceRange: {
                                min: itineraries.length > 0 ? Math.min(...itineraries.map((i: any) => i.totalPrice)) : 0,
                                max: itineraries.length > 0 ? Math.max(...itineraries.map((i: any) => i.totalPrice)) : 0
                            }
                        };
                    }
                }

                
                const pdfData = {
                    ...result,
                    searchParams: {
                        flights: payload.flights,
                        passengerCount: payload.passengerCount
                    },
                    filtersApplied: filters,
                    sortApplied: sortOption,
                    generatedAt: new Date().toISOString()
                };

                
                const pdfBuffer = await MultiCityFlightListPdfService.generateMultiCityFlightDetailsPDF(pdfData);

                return {
                    pdfBuffer,
                    isPdf: true
                };
            }

            const normalizedResult =
                MultiCityNormalizer.normalize(rawResponse.data, payload);

            let normalized = normalizedResult.flights;

            const airlineStats = normalizedResult.airlineStats;
            const selection = normalizedResult.selection;

            const isInternational = selection.mode === "INTERNATIONAL";
            const isDomestic = !isInternational;

            logFlightEvent("SEARCH_TRIPJACK_RESPONSE", {
                requestId,
                sessionId,
                searchType: "MULTICITY",
                mode: selection.mode,
                httpStatus: rawResponse.status,
                routeInfos: selection.routes,
                supplierOptions: selection.options.length,
                unmappable: selection.unmappable
            });

            if (payload?.searchModifiers?.isConnectingFlight === false) {
                if (isDomestic) {
                    normalized = normalized.map((leg: any) => ({
                        ...leg,
                        flights: (leg.flights || []).filter((f: any) => f.stops === 0)
                    }));
                } else if (isInternational) {
                    normalized = normalized.filter((it: any) => (it.legs || []).every((leg: any) => (leg.stops ?? 0) === 0));
                }
            }

            let originalCounts: Array<{ legIndex: number; count: number }> = [];

            if (isDomestic) {
                originalCounts = normalized.map((leg: any) => ({
                    legIndex: leg.legIndex,
                    count: leg.flights.length
                }));
            }

            if (filters && filters.length > 0) {
                const validation = MultiCityFlightFilter.validateFilters(filters);
                if (validation.isValid) {
                    if (isDomestic) {
                        normalized = MultiCityFlightFilter.applyFiltersToMultiCityFlights(
                            normalized,
                            filters,
                            applyToLegs || 'all'
                        );
                    } else if (isInternational) {
                        const filteredItineraries = normalized.filter((itinerary: any) => {
                            let allLegsMatch = true;
                            const legsToFilter = applyToLegs === 'all'
                                ? itinerary.legs.map((_: any, idx: number) => idx)
                                : applyToLegs || [];

                            for (const legIdx of legsToFilter) {
                                if (legIdx < itinerary.legs.length) {
                                    const legMatch = MultiCityFlightFilter.applyFilters([itinerary.legs[legIdx]], filters).length > 0;
                                    if (!legMatch) {
                                        allLegsMatch = false;
                                        break;
                                    }
                                }
                            }
                            return allLegsMatch;
                        });
                        normalized = filteredItineraries;
                    }
                } else {

                }
            }

            if (sortOption && MulticityFlightSorter.isValidSortField(sortOption.field)) {
                if (isDomestic) {
                    if (legIndex !== undefined && MulticityFlightSorter.isValidLegIndex(legIndex, normalized.length)) {
                        normalized = MulticityFlightSorter.sortSpecificLeg(normalized, sortOption, legIndex);
                    } else if (legIndex === undefined) {
                        normalized = MulticityFlightSorter.sortMultiCityFlights(normalized, sortOption);
                    }
                } else if (isInternational) {
                    if (sortOption.field === 'price') {
                        normalized.sort((a: any, b: any) => {
                            const comparison = a.totalPrice - b.totalPrice;
                            return sortOption.order === 'asc' ? comparison : -comparison;
                        });
                    }
                }
            }

            let stats: any = undefined;
            if (includeStats) {
                if (isDomestic) {
                    stats = MultiCityFlightFilter.getMultiCityFilterStats(normalized);
                    originalCounts.forEach((original: { legIndex: number; count: number }) => {
                        if (stats[original.legIndex]) {
                            stats[original.legIndex].totalFlights = original.count;
                            stats[original.legIndex].filteredFlights = normalized[original.legIndex]?.flights.length || 0;
                        }
                    });
                } else if (isInternational) {
                    stats = {
                        totalItineraries: normalized.length,
                        priceRange: {
                            min: normalized.length > 0 ? Math.min(...normalized.map((i: any) => i.totalPrice)) : 0,
                            max: normalized.length > 0 ? Math.max(...normalized.map((i: any) => i.totalPrice)) : 0
                        }
                    };
                }
            }

            if (includeFareRules && selection.options.length > 0) {
                const fareRulesByPriceId = await this.fetchFareRulesByPriceId(
                    selection.options.flatMap((option) => option.priceIds),
                    config,
                    { requestId, sessionId, mode: selection.mode }
                );

                const optionById = new Map(selection.options.map((option) => [option.optionId, option]));

                const attachFares = (target: any) => {
                    const option = optionById.get(target?.optionId);
                    if (!option) return;

                    target.availableFares = option.fares.map((fare) => {
                        const fareRule = fareRulesByPriceId.get(fare.priceId) ?? null;
                        const refundPolicy = this.extractRefundPolicyFromFareRule(fareRule);

                        return {
                            fareId: fare.priceId,
                            fareIdentifier: fare.fareIdentifier,
                            price: fare.totalPrice,
                            refundable: refundPolicy?.isRefundable || false,
                            refundPolicy: refundPolicy,
                            fareRule: fareRule
                        };
                    });

                    if (!target.availableFares.length) return;

                    const cheapestFare = target.availableFares.reduce(
                        (min: any, curr: any) => (curr.price < min.price ? curr : min),
                        target.availableFares[0]
                    );

                    target.refundable = cheapestFare.refundable;
                    target.refundPolicy = cheapestFare.refundPolicy;
                };

                if (isInternational) {
                    for (const itinerary of normalized) {
                        attachFares(itinerary);

                        for (const leg of (itinerary.legs || [])) {
                            leg.availableFares = itinerary.availableFares;
                            leg.refundable = itinerary.refundable;
                            leg.refundPolicy = itinerary.refundPolicy;
                        }
                    }
                } else {
                    for (const leg of normalized) {
                        for (const flight of (leg.flights || [])) {
                            attachFares(flight);
                        }
                    }
                }
            }

            await RedisCacheService.set(
                sessionId,
                {
                    raw: rawResponse?.data?.searchResult?.tripInfos,
                    isInternational: isInternational,
                    searchQuery: payload,
                    multicitySelection: selection
                },
                1800
            );

            const hasResults = normalized.length > 0;

            const response: any = {
                sessionId,
                type: hasResults ? (isInternational ? 'international' : 'domestic') : 'none',
                ...(isInternational && hasResults ? { itineraries: normalized } : {}),
                ...(isDomestic && hasResults ? { legs: normalized } : {}),
                flights: normalized,
                airlineStats,
                multicity: {
                    searchType: "MULTICITY",
                    mode: selection.mode,
                    selectionMode: selection.selectionMode,
                    sessionId,
                    routes: selection.routes,
                    options: selection.options,
                    unmappable: selection.unmappable
                }
            };

            if (stats) {
                response.stats = stats;
            }

            const displayedFlightsCount = isDomestic
                ? normalized.reduce((sum: number, leg: any) => sum + (leg.flights?.length || 0), 0)
                : normalized.length;

            logFlightEvent("SEARCH_RESPONSE", {
                requestId,
                sessionId,
                searchType: "MULTICITY",
                mode: selection.mode,
                optionsReturned: selection.options.length,
                displayedFlights: displayedFlightsCount
            });

            return response;

        } catch (error: any) {
            console.error("MultiCity Search ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message,
                stack: error.stack
            });

            throw error;
        }
    }

    private async fetchFareRulesByPriceId(
        priceIds: string[],
        config: { BASE_URL: string; FARE_RULE: string },
        context: { requestId: string; sessionId: string; mode: string }
    ): Promise<Map<string, any>> {
        const uniquePriceIds = [...new Set(priceIds.filter(Boolean))];
        const results = new Map<string, any>();

        if (!uniquePriceIds.length) return results;

        const url = `${config.BASE_URL}${config.FARE_RULE}`;

        logFlightEvent("FARE_RULE_REQUEST", {
            ...context,
            endpoint: config.FARE_RULE,
            flowType: "SEARCH",
            priceIdCount: uniquePriceIds.length
        });

        await mapWithConcurrency(uniquePriceIds, SearchService.FARE_RULE_CONCURRENCY, async (priceId) => {
            const cacheKey = `farerule:SEARCH:${priceId}`;
            const cached = await RedisCacheService.get(cacheKey).catch(() => null);
            if (cached?.rule !== undefined) {
                results.set(priceId, cached.rule);
                return;
            }

            try {
                const response = await axios.post(
                    url,
                    { flowType: "SEARCH", id: priceId },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            apikey: tripjackConfig.API_KEY,
                        },
                        timeout: SearchService.FARE_RULE_TIMEOUT_MS
                    }
                );
                results.set(priceId, response.data);
                await RedisCacheService.set(cacheKey, { rule: response.data }, 900).catch(() => undefined);
            } catch (error: any) {
                results.set(priceId, null);
                logFlightEvent("FARE_RULE_ERROR", {
                    ...context,
                    priceId,
                    endpoint: config.FARE_RULE,
                    httpStatus: error?.response?.status,
                    tripjackError: error?.response?.data?.errors?.[0]?.message || error?.message
                });
            }
        });

        logFlightEvent("FARE_RULE_RESPONSE", {
            ...context,
            requested: uniquePriceIds.length,
            resolved: [...results.values()].filter(Boolean).length
        });

        return results;
    }

    private extractRefundPolicyFromFareRule(fareRule: any): any {
        if (!fareRule) return null;

        const rules = fareRule?.fareRules || fareRule?.rules || fareRule;

        return {
            isRefundable: rules?.isRefundable || false,
            cancellationFee: rules?.cancellationFee || 0,
            refundableAmount: rules?.refundableAmount || 0,
            cancellationDeadline: rules?.lastCancellationDate || rules?.cancellationDeadline,
            currency: rules?.currency || 'INR',
            penaltyDetails: rules?.penalties || rules?.cancellationPenalties || [],
            termsAndConditions: rules?.terms || rules?.fareTerms || []
        };
    }

    public prepareTripjackSearchPayload(payload: any): any {
        if (!payload) return payload;
        const cloned = JSON.parse(JSON.stringify(payload));
        if (cloned.searchModifiers) {
            const pft = cloned.searchModifiers.pft;
            if (pft === 'REGULAR') {
                delete cloned.searchModifiers.pft;
            }
            if (Object.keys(cloned.searchModifiers).length === 0) {
                delete cloned.searchModifiers;
            }
        }
        return cloned;
    }

    // ── Helper: build a deterministic cache key from a one-way search payload ──
    private buildRouteKey(payload: any): string {
        try {
            const ri = payload?.routeInfos?.[0] ?? {};
            const from = (ri.fromCityOrAirport?.code ?? '').toUpperCase();
            const to   = (ri.toCityOrAirport?.code  ?? '').toUpperCase();
            const date = ri.travelDate ?? '';
            const cabin = (payload.cabinClass ?? 'ECONOMY').toUpperCase();
            const pax = JSON.stringify(payload.paxInfo ?? {});
            const pft = payload?.searchModifiers?.pft || 'REGULAR';
            const conn = payload?.searchModifiers?.isConnectingFlight ?? true;
            return `route:oneway:${from}:${to}:${date}:${cabin}:${pax}:${pft}:${conn}`;
        } catch {
            return '';
        }
    }
}

export default new SearchService();