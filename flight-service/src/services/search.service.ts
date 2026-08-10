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
import { OnewayFlightListPdfService } from "./onewayFlightListPdf.service";
import { ReturnFlightListPdfService } from "./returnFlightListPdf.service";
import { MultiCityFlightListPdfService } from "./multicityFlightListPdf.service";

class SearchService {

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
            const rawResponse = await axios.post(
                url,
                { searchQuery: payload },
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
            const rawResponse = await axios.post(
                url,
                { searchQuery: payload },
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

        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];
        const url = `${config.BASE_URL}${config.SEARCH}`;

        try {
            const rawResponse = await axios.post(
                url,
                { searchQuery: payload },
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: tripjackConfig.API_KEY,
                    },
                }
            );

            if (printData == "true" || printData == true) {
                
                const normalizedWithAllFares = MultiCityNormalizer.transformWithAllFares(rawResponse.data);

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
                MultiCityNormalizer.normalize(rawResponse.data);

            let normalized = normalizedResult.flights;

            const airlineStats = normalizedResult.airlineStats;

            const isDomestic = normalized.length > 0 && 'flights' in normalized[0];
            const isInternational = normalized.length > 0 && 'legs' in normalized[0];

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

            if (includeFareRules && normalized.length > 0) {
                if (isInternational) {
                    const allFareIds: string[] = [];
                    const fareIdToItineraryMap = new Map();

                    const tripInfos = rawResponse?.data?.searchResult?.tripInfos;
                    const combos = tripInfos?.COMBO || [];

                    for (let i = 0; i < combos.length; i++) {
                        const combo = combos[i];
                        if (combo.totalPriceList && combo.totalPriceList.length > 0) {
                            for (const fare of combo.totalPriceList) {
                                if (fare.id) {
                                    allFareIds.push(fare.id);
                                    fareIdToItineraryMap.set(fare.id, i);
                                }
                            }
                        }
                    }

                    const uniqueFareIds = [...new Set(allFareIds)];
                    const fareRulesMap = new Map();

                    for (const fareId of uniqueFareIds) {
                        try {
                            const fareRuleUrl = `${config.BASE_URL}${config.FARE_RULE}`;
                            const fareRuleResponse = await axios.post(
                                fareRuleUrl,
                                {
                                    flowType: "SEARCH",
                                    id: fareId
                                },
                                {
                                    headers: {
                                        "Content-Type": "application/json",
                                        apikey: tripjackConfig.API_KEY,
                                    }
                                }
                            );
                            fareRulesMap.set(fareId, fareRuleResponse.data);
                        } catch (error) {

                            fareRulesMap.set(fareId, null);
                        }
                    }

                    for (let i = 0; i < normalized.length; i++) {
                        const itinerary = normalized[i];
                        const originalCombo = combos[i];

                        if (originalCombo && originalCombo.totalPriceList) {
                            itinerary.availableFares = [];

                            for (const fare of originalCombo.totalPriceList) {
                                const fareRule = fareRulesMap.get(fare.id);
                                const refundPolicy = this.extractRefundPolicyFromFareRule(fareRule);

                                itinerary.availableFares.push({
                                    fareId: fare.id,
                                    fareIdentifier: fare.fareIdentifier,
                                    price: fare.fd?.ADULT?.fC?.TF || 0,
                                    refundable: refundPolicy?.isRefundable || false,
                                    refundPolicy: refundPolicy,
                                    fareRule: fareRule
                                });
                            }

                            const cheapestFare = itinerary.availableFares.reduce((min: any, curr: any) => {
                                return curr.price < min.price ? curr : min;
                            }, itinerary.availableFares[0]);

                            if (cheapestFare) {
                                itinerary.refundable = cheapestFare.refundable;
                                itinerary.refundPolicy = cheapestFare.refundPolicy;
                            }
                        }

                        if (itinerary.legs && itinerary.legs.length > 0) {
                            for (const leg of itinerary.legs) {
                                if (originalCombo && originalCombo.totalPriceList) {
                                    leg.availableFares = itinerary.availableFares;
                                    leg.refundable = itinerary.refundable;
                                    leg.refundPolicy = itinerary.refundPolicy;
                                }
                            }
                        }
                    }
                } else if (isDomestic) {
                    const tripInfos = rawResponse?.data?.searchResult?.tripInfos;

                    for (let legIdx = 0; legIdx < normalized.length; legIdx++) {
                        const leg = normalized[legIdx];
                        const legFlights = tripInfos?.[String(legIdx)] || [];

                        for (let flightIdx = 0; flightIdx < leg.flights.length; flightIdx++) {
                            const flight = leg.flights[flightIdx];
                            const originalFlight = legFlights[flightIdx];

                            if (originalFlight && originalFlight.totalPriceList) {
                                flight.availableFares = [];

                                for (const fare of originalFlight.totalPriceList) {
                                    try {
                                        const fareRuleUrl = `${config.BASE_URL}${config.FARE_RULE}`;
                                        const fareRuleResponse = await axios.post(
                                            fareRuleUrl,
                                            {
                                                flowType: "SEARCH",
                                                id: fare.id
                                            },
                                            {
                                                headers: {
                                                    "Content-Type": "application/json",
                                                    apikey: tripjackConfig.API_KEY,
                                                }
                                            }
                                        );

                                        const refundPolicy = this.extractRefundPolicyFromFareRule(fareRuleResponse.data);

                                        flight.availableFares.push({
                                            fareId: fare.id,
                                            fareIdentifier: fare.fareIdentifier,
                                            price: fare.fd?.ADULT?.fC?.TF || 0,
                                            refundable: refundPolicy?.isRefundable || false,
                                            refundPolicy: refundPolicy,
                                            fareRule: fareRuleResponse.data
                                        });
                                    } catch (error) {

                                        flight.availableFares.push({
                                            fareId: fare.id,
                                            fareIdentifier: fare.fareIdentifier,
                                            price: fare.fd?.ADULT?.fC?.TF || 0,
                                            refundable: false,
                                            refundPolicy: null,
                                            fareRule: null
                                        });
                                    }
                                }

                                const cheapestFare = flight.availableFares.reduce((min: any, curr: any) => {
                                    return curr.price < min.price ? curr : min;
                                }, flight.availableFares[0]);

                                if (cheapestFare) {
                                    flight.refundable = cheapestFare.refundable;
                                    flight.refundPolicy = cheapestFare.refundPolicy;
                                }
                            }
                        }
                    }
                }
            }

            await RedisCacheService.set(
                sessionId,
                {
                    raw: rawResponse?.data?.searchResult?.tripInfos,
                    isInternational: isInternational
                },
                1800
            );

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
            console.error("MultiCity Search ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message,
                stack: error.stack
            });

            throw error;
        }
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