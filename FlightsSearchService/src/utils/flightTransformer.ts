import { FareDetail, TransformedFlight, TripInfo } from "../interface/flight/flight.interface";


/**
 * Transform TripJack API response to structured flight data
 * @param tripInfos TripInfo array from API response
 * @returns Array of transformed flights
 */
export function transformFlightsForDisplay(tripInfos: TripInfo[]): TransformedFlight[] {
    if (!tripInfos || tripInfos.length === 0) {
        return [];
    }

    return tripInfos.map((tripInfo, index) => {
        const segment = tripInfo.sI[0];
        const fareOptions = transformFareOptions(tripInfo.totalPriceList, segment.id);

        const departureDate = new Date(segment.dt);
        const arrivalDate = new Date(segment.at);

        return {
            flightId: `${segment.fD.aI.code}_${segment.fD.fN}_${index}`,
            segmentId: segment.id, 
            airline: {
                code: segment.fD.aI.code,
                name: segment.fD.aI.name,
                isLcc: segment.fD.aI.isLcc,
            },
            flightNumber: segment.fD.fN,
            aircraftType: segment.fD.eT,
            departure: {
                airportCode: segment.da.code,
                airportName: segment.da.name,
                cityCode: segment.da.cityCode,
                city: segment.da.city,
                terminal: segment.da.terminal,
                time: departureDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                date: departureDate.toLocaleDateString(),
            },
            arrival: {
                airportCode: segment.aa.code,
                airportName: segment.aa.name,
                cityCode: segment.aa.cityCode,
                city: segment.aa.city,
                terminal: segment.aa.terminal,
                time: arrivalDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                date: arrivalDate.toLocaleDateString(),
            },
            duration: segment.duration,
            stops: segment.stops,
            fareOptions,
            isInternational: segment.iand,
            isRedEye: segment.isRs,
        };
    });
}

/**
 * Transform fare options for a specific flight segment
 * @param totalPriceList FareDetail array from API
 * @param segmentId Segment ID to match baggage info
 * @returns Array of structured fare options
 */
function transformFareOptions(
    totalPriceList: FareDetail[],
    segmentId: string
): TransformedFlight['fareOptions'] {
    return totalPriceList.map((fare) => {
        const adultFare = fare.fd.ADULT;
        const fareBreakdown = adultFare.afC?.TAF;


        const segmentBaggage = fare.tai?.tbi?.[segmentId]?.[0]?.ADULT || adultFare.bI;

        return {
            id: fare.id,
            fareIdentifier: fare.fareIdentifier,
            cabinClass: adultFare.cc,
            bookingClass: adultFare.cB,
            fareBasis: adultFare.fB,
            baseFare: adultFare.fC.BF,
            taxesAndFees: adultFare.fC.TAF,
            totalFare: adultFare.fC.TF,
            netFare: adultFare.fC.NF,
            refundable: adultFare.rT === 1,
            baggage: {
                checked: segmentBaggage.iB,
                cabin: segmentBaggage.cB,
            },
            seatAvailability: adultFare.sR,
            fareBreakdown: fareBreakdown ? {
                managementFee: fareBreakdown.MFT,
                otherTax: fareBreakdown.OT,
                serviceTax: fareBreakdown.AGST,
                airportTax: fareBreakdown.MF,
                fuelSurcharge: fareBreakdown.YR,
            } : undefined,
        };
    });
}

/**
 * Get detailed flight information by flight ID
 * @param tripInfos All trip information from API
 * @param flightId The flight ID to find
 * @returns Detailed flight information or null if not found
 */
export function getFlightDetailsById(
    tripInfos: TripInfo[],
    flightId: string
): TransformedFlight | null {
    const transformedFlights = transformFlightsForDisplay(tripInfos);

    return transformedFlights.find(flight => flight.flightId === flightId) || null;
}

/**
 * Get all flights with basic info (for listing)
 * @param tripInfos All trip information from API
 * @returns Array of flights with essential info only
 */
export function getFlightList(tripInfos: TripInfo[]): {
    flightId: string;
    segmentId: string;
    airline: {
        code: string;
        name: string;
    };
    flightNumber: string;
    departure: {
        airportCode: string;
        time: string;
    };
    arrival: {
        airportCode: string;
        time: string;
    };
    duration: number;
    stops: number;
    lowestFare: number;
    fareOptionsCount: number;
}[] {
    const flightList = [];

    for (let i = 0; i < tripInfos.length; i++) {
        const tripInfo = tripInfos[i];
        const segment = tripInfo.sI[0];

        if (!segment) continue;


        const lowestFare = Math.min(
            ...tripInfo.totalPriceList.map(option => option.fd.ADULT.fC.NF)
        );

        const departureDate = new Date(segment.dt);
        const arrivalDate = new Date(segment.at);

        flightList.push({
            flightId: `${segment.fD.aI.code}_${segment.fD.fN}_${i}`,
            segmentId: segment.id,
            airline: {
                code: segment.fD.aI.code,
                name: segment.fD.aI.name,
            },
            flightNumber: segment.fD.fN,
            departure: {
                airportCode: segment.da.code,
                time: departureDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
            },
            arrival: {
                airportCode: segment.aa.code,
                time: arrivalDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
            },
            duration: segment.duration,
            stops: segment.stops,
            lowestFare,
            fareOptionsCount: tripInfo.totalPriceList.length,
        });
    }

    return flightList;
}

export function getFlightBySegmentId(
    tripInfos: TripInfo[],
    segmentId: string
) {
    for (const tripInfo of tripInfos) {
        const segment = tripInfo.sI.find(s => s.id === segmentId);

        if (segment) {
            return {
                tripInfo,
                segment,
                fareOptions: tripInfo.totalPriceList,
            };
        }
    }

    return null;
}