import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import tripjackConfig from "../config/tripjack.config";
import { TRIPJACK_URLS } from "../config";
import { OneWayNormalizer } from "../normalizers/oneway.normalizer";
import RedisCacheService from "../cache/redisCache.service";
import { ReturnNormalizer } from "../normalizers/return.normalizer";
import { MultiCityNormalizer } from "../normalizers/multicity.normalizer";
import { OnewayFlightSorter } from "../utils/sorter/onewaySort.utils";
import { SortOption } from "../types/sort.types";
import { Filter, FilterStats } from "../types/filter.types";
import { FlightFilter } from "../utils/sorter/filter.utils";
import { ReturnFlightSorter } from "../utils/sorter/returnSort.utils";
import { MulticityFlightSorter } from "../utils/sorter/multiSort.utils";
import { MultiCityFlightFilter } from "../utils/sorter/multiFilter.utils";

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


            const originalOnwardCount = normalized.onward.length;
            const originalReturnCount = normalized.return.length;

            if (filters && filters.length > 0) {
                const validation = FlightFilter.validateFilters(filters);
                if (validation.isValid) {
                    normalized = FlightFilter.applyFiltersToReturnFlights(
                        normalized,
                        filters,
                        filterTarget
                    );
                } else {
                    console.warn('Invalid filters:', validation.errors);
                }
            }

            if (sortOption && ReturnFlightSorter.isValidSortField(sortOption.field)) {
                normalized = ReturnFlightSorter.sortReturnFlights(normalized, sortOption, sortTarget);
            }

            let stats: any = undefined;
            if (includeStats) {
                stats = {
                    onward: FlightFilter.getFilterStats(normalized.onward),
                    return: FlightFilter.getFilterStats(normalized.return)
                };
                stats.onward.totalFlights = originalOnwardCount;
                stats.return.totalFlights = originalReturnCount;
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

    // async searchReturn(payload: any) {

    //     const sessionId = uuidv4();

    //     const env = tripjackConfig.ENV;
    //     const config = TRIPJACK_URLS[env];
    //     const url = `${config.BASE_URL}${config.SEARCH}`;

    //     try {
    //         const rawResponse = await axios.post(
    //             url,
    //             { searchQuery: payload },
    //             {
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                     apikey: tripjackConfig.API_KEY,
    //                 },
    //             }
    //         );

    //         const normalized = ReturnNormalizer.transform(rawResponse);

    //         await RedisCacheService.set(sessionId, {
    //             raw: rawResponse?.data?.searchResult?.tripInfos,
    //         }, 1800);

    //         return {
    //             sessionId,
    //             flights: normalized
    //         };

    //     } catch (error: any) {
    //         console.error("Return Search ERROR >>>", {
    //             status: error.response?.status,
    //             data: JSON.stringify(error.response?.data, null, 2),
    //             message: error.message
    //         });

    //         throw error;
    //     }
    // }

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

            const originalCounts = normalized.map(leg => ({
                legIndex: leg.legIndex,
                count: leg.flights.length
            }));

            if (filters && filters.length > 0) {
                const validation = MultiCityFlightFilter.validateFilters(filters);
                if (validation.isValid) {
                    normalized = MultiCityFlightFilter.applyFiltersToMultiCityFlights(
                        normalized,
                        filters,
                        applyToLegs || 'all'
                    );
                } else {
                    console.warn('Invalid filters:', validation.errors);
                }
            }

            if (sortOption && MulticityFlightSorter.isValidSortField(sortOption.field)) {
                if (legIndex !== undefined && MulticityFlightSorter.isValidLegIndex(legIndex, normalized.length)) {
                    normalized = MulticityFlightSorter.sortSpecificLeg(normalized, sortOption, legIndex);
                } else if (legIndex === undefined) {
                    normalized = MulticityFlightSorter.sortMultiCityFlights(normalized, sortOption);
                }
            }

            let stats: any = undefined;
            if (includeStats) {
                stats = MultiCityFlightFilter.getMultiCityFilterStats(normalized);
                originalCounts.forEach(original => {
                    if (stats[original.legIndex]) {
                        stats[original.legIndex].totalFlights = original.count;
                        stats[original.legIndex].filteredFlights = normalized[original.legIndex]?.flights.length || 0;
                    }
                });
            }

            await RedisCacheService.set(
                sessionId,
                {
                    raw: rawResponse?.data?.searchResult?.tripInfos,
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
                message: error.message
            });

            throw error;
        }
    }

    // async searchMulticity(payload: any) {

    //     const sessionId = uuidv4();

    //     const env = tripjackConfig.ENV;
    //     const config = TRIPJACK_URLS[env];
    //     const url = `${config.BASE_URL}${config.SEARCH}`;

    //     try {
    //         const rawResponse = await axios.post(
    //             url,
    //             { searchQuery: payload },
    //             {
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                     apikey: tripjackConfig.API_KEY,
    //                 },
    //             }
    //         );

    //         const normalized = MultiCityNormalizer.normalize(rawResponse.data);

    //         await RedisCacheService.set(
    //             sessionId,
    //             {
    //                 raw: rawResponse?.data?.searchResult?.tripInfos,
    //             },
    //             1800
    //         );

    //         return {
    //             sessionId,
    //             flights: normalized
    //         };

    //     } catch (error: any) {
    //         console.error("MultiCity Search ERROR >>>", {
    //             status: error.response?.status,
    //             data: JSON.stringify(error.response?.data, null, 2),
    //             message: error.message
    //         });

    //         throw error;
    //     }
    // }
}

export default new SearchService();