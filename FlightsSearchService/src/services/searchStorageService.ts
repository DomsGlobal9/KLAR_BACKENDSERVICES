import { getCache, setCache, deleteCache } from "./redisService";

export interface StoredSearchResult {
    sessionId: string;
    tripType: 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';
    searchParams: any;
    rawData: any; // Original TripJack response
    transformedData: any; // Transformed flight data
    createdAt: number;
    expiresAt: number;
}

export interface FlightListItem {
    flightId: string;
    sessionId: string;
    flightIndex: number;
    legIndex?: number; // For multi-city
    fareOptionIndex?: number; // Which fare option is selected
}

class SearchStorageService {
    private readonly TTL = 30 * 60; // 30 minutes in seconds
    private readonly SESSION_PREFIX = 'flight_search:';
    private readonly FLIGHT_PREFIX = 'flight:';

    /**
     * Generate a unique session ID for this search
     */
    generateSessionId(): string {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Store complete search results
     */
    async storeSearchResults(
        sessionId: string,
        tripType: string,
        searchParams: any,
        rawData: any,
        transformedData: any
    ): Promise<void> {
        const storageKey = `${this.SESSION_PREFIX}${sessionId}`;
        
        const storedData: StoredSearchResult = {
            sessionId,
            tripType: tripType as any,
            searchParams,
            rawData,
            transformedData,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.TTL * 1000)
        };

        await setCache(storageKey, JSON.stringify(storedData), this.TTL);
        
        // Also store individual flights for quick access
        await this.storeIndividualFlights(sessionId, tripType, transformedData);
        
        console.log(`✅ Search results stored with session ID: ${sessionId}`);
    }

    /**
     * Store individual flights for quick retrieval
     */
    private async storeIndividualFlights(
        sessionId: string,
        tripType: string,
        transformedData: any
    ): Promise<void> {
        if (tripType === 'ONE_WAY' && Array.isArray(transformedData)) {
            // Store each flight individually
            for (let i = 0; i < transformedData.length; i++) {
                const flight = transformedData[i];
                const flightKey = `${this.FLIGHT_PREFIX}${sessionId}:oneway:${i}`;
                await setCache(flightKey, JSON.stringify({
                    flight,
                    sessionId,
                    flightIndex: i,
                    tripType: 'ONE_WAY'
                }), this.TTL);
            }
        } 
        else if (tripType === 'RETURN' && Array.isArray(transformedData)) {
            // Store each combination
            for (let i = 0; i < transformedData.length; i++) {
                const combination = transformedData[i];
                const flightKey = `${this.FLIGHT_PREFIX}${sessionId}:return:${i}`;
                await setCache(flightKey, JSON.stringify({
                    combination,
                    sessionId,
                    combinationIndex: i,
                    tripType: 'RETURN'
                }), this.TTL);
            }
        }
        else if (tripType === 'MULTI_CITY' && Array.isArray(transformedData)) {
            // Store each leg's flights
            for (let legIndex = 0; legIndex < transformedData.length; legIndex++) {
                const leg = transformedData[legIndex];
                for (let flightIndex = 0; flightIndex < leg.flights.length; flightIndex++) {
                    const flight = leg.flights[flightIndex];
                    const flightKey = `${this.FLIGHT_PREFIX}${sessionId}:multicity:${legIndex}:${flightIndex}`;
                    await setCache(flightKey, JSON.stringify({
                        flight,
                        sessionId,
                        legIndex,
                        flightIndex,
                        tripType: 'MULTI_CITY'
                    }), this.TTL);
                }
            }
        }
    }

    /**
     * Get search results by session ID
     */
    async getSearchResults(sessionId: string): Promise<StoredSearchResult | null> {
        const storageKey = `${this.SESSION_PREFIX}${sessionId}`;
        const cached = await getCache(storageKey);
        
        if (!cached) {
            console.log(`❌ No search results found for session: ${sessionId}`);
            return null;
        }
        
        return JSON.parse(cached);
    }

    /**
     * Get specific flight by session ID and flight index
     */
    async getFlightByIndex(
        sessionId: string,
        tripType: string,
        flightIndex: number,
        legIndex?: number
    ): Promise<any | null> {
        let flightKey: string;
        
        if (tripType === 'ONE_WAY') {
            flightKey = `${this.FLIGHT_PREFIX}${sessionId}:oneway:${flightIndex}`;
        } 
        else if (tripType === 'RETURN') {
            flightKey = `${this.FLIGHT_PREFIX}${sessionId}:return:${flightIndex}`;
        }
        else if (tripType === 'MULTI_CITY' && legIndex !== undefined) {
            flightKey = `${this.FLIGHT_PREFIX}${sessionId}:multicity:${legIndex}:${flightIndex}`;
        }
        else {
            return null;
        }
        
        const cached = await getCache(flightKey);
        return cached ? JSON.parse(cached) : null;
    }

    /**
     * Get complete flight details by session ID and flight ID
     */
    async getFlightDetails(
        sessionId: string,
        flightId: string
    ): Promise<any | null> {
        // First get the full search results
        const searchResults = await this.getSearchResults(sessionId);
        if (!searchResults) return null;
        
        const { tripType, transformedData } = searchResults;
        
        // Find the flight in the transformed data
        if (tripType === 'ONE_WAY' && Array.isArray(transformedData)) {
            const flight = transformedData.find((f: any) => f.flightId === flightId);
            return flight ? { flight, tripType: 'ONE_WAY' } : null;
        }
        
        if (tripType === 'RETURN' && Array.isArray(transformedData)) {
            const combination = transformedData.find((c: any) => 
                c.combinationId === flightId || 
                c.onward.flightId === flightId || 
                c.return.flightId === flightId
            );
            return combination ? { combination, tripType: 'RETURN' } : null;
        }
        
        if (tripType === 'MULTI_CITY' && Array.isArray(transformedData)) {
            for (const leg of transformedData) {
                const flight = leg.flights.find((f: any) => f.flightId === flightId);
                if (flight) {
                    return { flight, leg, tripType: 'MULTI_CITY' };
                }
            }
        }
        
        return null;
    }

    /**
     * Delete search results (when new search is performed)
     */
    async deleteSearchResults(sessionId: string): Promise<void> {
        const storageKey = `${this.SESSION_PREFIX}${sessionId}`;
        await deleteCache(storageKey);
        
        // Also delete individual flight keys (optional - they'll expire anyway)
        console.log(`🗑️ Deleted search results for session: ${sessionId}`);
    }

    /**
     * Clean up old sessions (can be called periodically)
     */
    async cleanupExpiredSessions(): Promise<void> {
        // Redis handles TTL automatically, but you can add additional cleanup if needed
        console.log('🧹 Redis TTL handles automatic cleanup');
    }
}

export const searchStorage = new SearchStorageService();