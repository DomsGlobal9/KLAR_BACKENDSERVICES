import { FlightDetailsResponse, SegmentResponse, TripInfo, TripJackSearchPayload } from "../interface/flight/flight.interface";
import { searchFromTripJack } from "../services/tripjackService";


/**
 * Get specific flight segment by its ID from sI array
 * @param payload TripJack search payload
 * @param segmentId The ID of the flight segment (from sI.id)
 * @returns Segment details with fare options
 */
export async function getFlightSegmentById(
    payload: TripJackSearchPayload,
    segmentId: string
): Promise<SegmentResponse | null> {
    try {
        const data = await searchFromTripJack(payload);

        const tripInfos: TripInfo[] = data.searchResult?.tripInfos?.ONWARD || [];

        for (const tripInfo of tripInfos) {
            const segment = tripInfo.sI.find(s => s.id === segmentId);

            if (segment) {
                return {
                    segment,
                    fareOptions: tripInfo.totalPriceList,
                    tripInfo: {
                        sI: tripInfo.sI,
                        totalPriceList: tripInfo.totalPriceList,
                        airFlowType: tripInfo.airFlowType,
                        ipm: tripInfo.ipm,
                        issf: tripInfo.issf
                    }
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error fetching flight segment:", error);
        throw error;
    }
}

/**
 * Get flight details by ANY segment ID from the flight
 * Returns ALL segments of that flight
 */
export async function getFlightDetailsBySegmentId(
    payload: TripJackSearchPayload,
    segmentId: string
): Promise<FlightDetailsResponse | null> {
    try {
        const data = await searchFromTripJack(payload);

        // Check all possible trip info locations
        const tripInfos: TripInfo[] = [
            ...(data.searchResult?.tripInfos?.ONWARD || []),
            ...(data.searchResult?.tripInfos?.RETURN || [])
        ];

        // Also check numeric keys for multi-city
        const tripInfoObj = data.searchResult?.tripInfos || {};
        Object.keys(tripInfoObj).forEach(key => {
            if (key !== 'ONWARD' && key !== 'RETURN' && Array.isArray(tripInfoObj[key])) {
                tripInfos.push(...tripInfoObj[key]);
            }
        });

        // Find the trip info containing this segment
        for (const tripInfo of tripInfos) {
            const segmentIndex = tripInfo.sI.findIndex(s => s.id === segmentId);

            if (segmentIndex !== -1) {
                // Found the flight - return ALL segments
                const allSegments = tripInfo.sI;
                const firstSegment = allSegments[0];
                const lastSegment = allSegments[allSegments.length - 1];

                const departureDate = new Date(firstSegment.dt);
                const arrivalDate = new Date(lastSegment.at);

                return {
                    flightId: `${firstSegment.fD.aI.code}_${firstSegment.fD.fN}_${Date.now()}`,
                    segments: allSegments,
                    fareOptions: tripInfo.totalPriceList,
                    tripInfo: {
                        sI: tripInfo.sI,
                        totalPriceList: tripInfo.totalPriceList,
                        airFlowType: tripInfo.airFlowType,
                        ipm: tripInfo.ipm,
                        issf: tripInfo.issf
                    },
                    totalStops: allSegments.length - 1,
                    totalDuration: allSegments.reduce((sum, seg) => sum + (seg.duration || 0), 0),
                    departure: {
                        airportCode: firstSegment.da.code,
                        airportName: firstSegment.da.name,
                        cityCode: firstSegment.da.cityCode,
                        city: firstSegment.da.city,
                        terminal: firstSegment.da.terminal,
                        time: departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        date: departureDate.toLocaleDateString()
                    },
                    arrival: {
                        airportCode: lastSegment.aa.code,
                        airportName: lastSegment.aa.name,
                        cityCode: lastSegment.aa.cityCode,
                        city: lastSegment.aa.city,
                        terminal: lastSegment.aa.terminal,
                        time: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        date: arrivalDate.toLocaleDateString()
                    },
                    airlines: allSegments.map(s => ({
                        code: s.fD.aI.code,
                        name: s.fD.aI.name,
                        isLcc: s.fD.aI.isLcc
                    })),
                    flightNumbers: allSegments.map(s => s.fD.fN)
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error fetching flight details:", error);
        throw error;
    }
}

/**
 * Get transformed flight segment with structured data
 * @param payload TripJack search payload
 * @param segmentId The ID of the flight segment
 * @returns Transformed segment data
 */
export async function getTransformedFlightSegment(
    payload: TripJackSearchPayload,
    segmentId: string
) {
    const segmentData = await getFlightSegmentById(payload, segmentId);

    if (!segmentData) {
        return null;
    }

    const { segment, fareOptions } = segmentData;


    const departureDate = new Date(segment.dt);
    const arrivalDate = new Date(segment.at);

    const transformedSegment = {
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
            datetime: segment.dt,
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
            datetime: segment.at,
        },
        duration: segment.duration,
        stops: segment.stops,
        isInternational: segment.iand,
        isRedEye: segment.isRs,
    };


    const transformedFareOptions = fareOptions.map(fare => {
        const adultFare = fare.fd.ADULT;
        const fareBreakdown = adultFare.afC?.TAF;


        const segmentBaggage = fare.tai?.tbi?.[segment.id]?.[0]?.ADULT || adultFare.bI;

        return {
            fareId: fare.id,
            fareIdentifier: fare.fareIdentifier,
            cabinClass: adultFare.cc,
            bookingClass: adultFare.cB,
            fareBasis: adultFare.fB,
            baseFare: adultFare.fC.BF,
            taxesAndFees: adultFare.fC.TAF,
            totalFare: adultFare.fC.TF,
            netFare: adultFare.fC.NF,
            onboardFee: adultFare.fC.OB,
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
            isCorporateFare: fare.icca,
        };
    });

    return {
        segment: transformedSegment,
        fareOptions: transformedFareOptions,
        segmentCount: segmentData.tripInfo.sI.length,
    };
}