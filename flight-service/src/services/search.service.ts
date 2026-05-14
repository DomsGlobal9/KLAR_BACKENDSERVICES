import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { TRIPJACK_URLS } from "../config";
import { SortOption } from "../types/sort.types";
import tripjackConfig from "../config/tripjack.config";
import RedisCacheService from "../cache/redisCache.service";
import { Filter, FilterStats } from "../types/filter.types";
import { FlightFilter } from "../utils/sorter/filter.utils";
import { OneWayNormalizer } from "../normalizers/oneway.normalizer";
import { ReturnNormalizer } from "../normalizers/return.normalizer";
import { OnewayFlightSorter } from "../utils/sorter/onewaySort.utils";
import { ReturnFlightSorter } from "../utils/sorter/returnSort.utils";
import { MulticityFlightSorter } from "../utils/sorter/multiSort.utils";
import { MultiCityFlightFilter } from "../utils/sorter/multiFilter.utils";
import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";
import { FlightSegment } from "../types/returnFilter.types";

class SearchService {

    async searchOneWay(
        payload: any,
        sortOption?: SortOption,
        filters?: Filter[],
        includeStats: boolean = false
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

            let normalized = OneWayNormalizer.transform(rawResponse);

            const originalCount = normalized.length;

            if (filters && filters.length > 0) {
                const validation = FlightFilter.validateFilters(filters);
                if (validation.isValid) {
                    normalized = FlightFilter.applyFilters(normalized, filters);
                } else {
                    console.warn('Invalid filters:', validation.errors);
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

            await RedisCacheService.set(sessionId, {
                raw: rawResponse?.data?.searchResult?.tripInfos,
            }, 1800);

            const response: any = {
                sessionId,
                flights: normalized
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
        includeStats: boolean = false
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

            let normalized = ReturnNormalizer.transform(rawResponse);

            const isDomestic = 'onward' in normalized && 'return' in normalized;
            const isInternational = 'roundTrips' in normalized;

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
                    console.warn('Invalid filters:', validation.errors);
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
                flights: normalized
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
        includeStats: boolean = false
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

            let normalized = MultiCityNormalizer.normalize(rawResponse.data);

            const isDomestic = normalized.length > 0 && 'flights' in normalized[0];
            const isInternational = normalized.length > 0 && 'legs' in normalized[0];

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
                    console.warn('Invalid filters:', validation.errors);
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
                flights: normalized
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
}

export default new SearchService();