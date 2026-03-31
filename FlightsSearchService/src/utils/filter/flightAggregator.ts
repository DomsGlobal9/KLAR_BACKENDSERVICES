import { PriceRange, FlightFilters } from "../../interface/flight/filter.interface";

export interface StopOption {
  type: string; // 'non-stop', '1-stop', '2+ stops'
  count: number;
  flightCount: number;
}

export interface AirlineOption {
  code: string;
  name: string;
  flightCount: number;
  minPrice: number;
}

export interface TimeBucket {
  bucket: string; // 'Morning', 'Afternoon', 'Evening', 'Night'
  startHour: number;
  endHour: number;
  flightCount: number;
}

export interface LayoverAirport {
  code: string;
  name: string;
  city: string;
  flightCount: number;
}

export interface RefundType {
  type: string; // 'FULLY_REFUNDABLE', 'NON_REFUNDABLE', 'PARTIALLY_REFUNDABLE'
  flightCount: number;
  minPrice: number;
}

export interface AggregationResult {
  priceRange: PriceRange;
  stops: StopOption[];
  airlines: AirlineOption[];
  departureTimeBuckets: TimeBucket[];
  arrivalTimeBuckets: TimeBucket[];
  layoverAirports: LayoverAirport[];
  refundTypes: RefundType[];
}

// Removed redundant FlightFilters interface as it is now imported from filter.interface.ts

export interface SortOptions {
  type: 'CHEAPEST' | 'QUICKEST' | 'EARLY_DEPARTURE' | 'EARLY_ARRIVAL';
  order?: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export class FlightAggregator {
  
  /**
   * Compute all aggregations from flight list
   */
  static computeAggregations(flights: any[], tripType: string): AggregationResult {
    if (!flights || flights.length === 0) {
      return this.getEmptyAggregation();
    }

    const priceRange = this.computePriceRange(flights);
    const stops = this.computeStopsAggregation(flights);
    const airlines = this.computeAirlinesAggregation(flights);
    const departureTimeBuckets = this.computeTimeBuckets(flights, 'departure');
    const arrivalTimeBuckets = this.computeTimeBuckets(flights, 'arrival');
    const layoverAirports = this.computeLayoverAirports(flights);
    const refundTypes = this.computeRefundTypes(flights);

    return {
      priceRange,
      stops,
      airlines,
      departureTimeBuckets,
      arrivalTimeBuckets,
      layoverAirports,
      refundTypes
    };
  }

  private static computePriceRange(flights: any[]): PriceRange {
    let min = Infinity;
    let max = -Infinity;

    flights.forEach(flight => {
      const price = this.getFlightPrice(flight);
      if (price < min) min = price;
      if (price > max) max = price;
    });

    return { min, max };
  }

  private static computeStopsAggregation(flights: any[]): StopOption[] {
    const stopMap = new Map<string, StopOption>();
    
    flights.forEach(flight => {
      const stopCount = this.getStopCount(flight);
      const stopType = this.getStopType(stopCount);
      
      if (!stopMap.has(stopType)) {
        stopMap.set(stopType, {
          type: stopType,
          count: stopCount,
          flightCount: 0
        });
      }
      
      stopMap.get(stopType)!.flightCount++;
    });

    return Array.from(stopMap.values()).sort((a, b) => a.count - b.count);
  }

  private static computeAirlinesAggregation(flights: any[]): AirlineOption[] {
    const airlineMap = new Map<string, AirlineOption>();
    
    flights.forEach(flight => {
      const airlineCode = this.getAirlineCode(flight);
      const airlineName = this.getAirlineName(flight);
      const price = this.getFlightPrice(flight);
      
      if (!airlineMap.has(airlineCode)) {
        airlineMap.set(airlineCode, {
          code: airlineCode,
          name: airlineName,
          flightCount: 0,
          minPrice: Infinity
        });
      }
      
      const airline = airlineMap.get(airlineCode)!;
      airline.flightCount++;
      if (price < airline.minPrice) airline.minPrice = price;
    });

    return Array.from(airlineMap.values()).sort((a, b) => b.flightCount - a.flightCount);
  }

  private static computeTimeBuckets(flights: any[], type: 'departure' | 'arrival'): TimeBucket[] {
    const buckets = [
      { bucket: 'Morning', startHour: 0, endHour: 11, count: 0 },
      { bucket: 'Afternoon', startHour: 12, endHour: 16, count: 0 },
      { bucket: 'Evening', startHour: 17, endHour: 20, count: 0 },
      { bucket: 'Night', startHour: 21, endHour: 23, count: 0 }
    ];

    flights.forEach(flight => {
      const timeStr = type === 'departure' 
        ? this.getDepartureTime(flight)
        : this.getArrivalTime(flight);
      
      const hour = new Date(timeStr).getHours();
      
      for (const bucket of buckets) {
        if (hour >= bucket.startHour && hour <= bucket.endHour) {
          bucket.count++;
          break;
        }
      }
    });

    return buckets.map(b => ({
      bucket: b.bucket,
      startHour: b.startHour,
      endHour: b.endHour,
      flightCount: b.count
    }));
  }

  private static computeLayoverAirports(flights: any[]): LayoverAirport[] {
    const airportMap = new Map<string, LayoverAirport>();
    
    flights.forEach(flight => {
      const layovers = this.getLayoverAirports(flight);
      
      layovers.forEach(layover => {
        if (!airportMap.has(layover.code)) {
          airportMap.set(layover.code, {
            code: layover.code,
            name: layover.name,
            city: layover.city,
            flightCount: 0
          });
        }
        
        airportMap.get(layover.code)!.flightCount++;
      });
    });

    return Array.from(airportMap.values())
      .sort((a, b) => b.flightCount - a.flightCount)
      .slice(0, 20); // Top 20 layover airports
  }

  private static computeRefundTypes(flights: any[]): RefundType[] {
    const refundMap = new Map<string, RefundType>();
    
    flights.forEach(flight => {
      const refundType = this.getRefundType(flight);
      
      if (!refundMap.has(refundType)) {
        refundMap.set(refundType, {
          type: refundType,
          flightCount: 0,
          minPrice: Infinity
        });
      }
      
      const refund = refundMap.get(refundType)!;
      refund.flightCount++;
      const price = this.getFlightPrice(flight);
      if (price < refund.minPrice) refund.minPrice = price;
    });

    return Array.from(refundMap.values());
  }

  // Helper methods to extract flight data (implement based on your flight structure)
  private static getFlightPrice(flight: any): number {
    if (!flight.fareOptions || flight.fareOptions.length === 0) return 0;
    // Return the lowest fare price
    return Math.min(...flight.fareOptions.map((f: any) => f.totalFare || 0));
  }

  private static getStopCount(flight: any): number {
    return flight.stops || 0;
  }

  private static getStopType(stopCount: number): string {
    if (stopCount === 0) return 'non-stop';
    if (stopCount === 1) return '1-stop';
    return '2+ stops';
  }

  private static getAirlineCode(flight: any): string {
    return flight.airline?.code || 'UNKNOWN';
  }

  private static getAirlineName(flight: any): string {
    return flight.airline?.name || 'Unknown Airline';
  }

  private static getDepartureTime(flight: any): string {
    return flight.departure?.datetime || flight.departure?.time || '';
  }

  private static getArrivalTime(flight: any): string {
    return flight.arrival?.datetime || flight.arrival?.time || '';
  }

  private static getLayoverAirports(flight: any): Array<{code: string, name: string, city: string}> {
    // Layover information might not be directly in the flattened TransformedFlight
    // If it's missing, return empty or implement based on your structure
    return [];
  }

  private static getRefundType(flight: any): string {
    if (!flight.fareOptions || flight.fareOptions.length === 0) return 'NON_REFUNDABLE';
    const isRefundable = flight.fareOptions.some((f: any) => f.refundable === true);
    return isRefundable ? 'REFUNDABLE' : 'NON_REFUNDABLE';
  }

  private static getEmptyAggregation(): AggregationResult {
    return {
      priceRange: { min: 0, max: 0 },
      stops: [],
      airlines: [],
      departureTimeBuckets: [],
      arrivalTimeBuckets: [],
      layoverAirports: [],
      refundTypes: []
    };
  }
}