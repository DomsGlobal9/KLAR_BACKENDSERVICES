import { FareDetail, TransformedFlight, TripInfo, FlightSegment } from "../interface/flight/flight.interface";
type TripType = 'ONE_WAY' | 'RETURN' | 'MULTI_CITY';

/**
 * Transform TripJack API response to structured flight data
 * Handles One-way, Return, and Multi-city flights
 */
export function transformFlightsForDisplay(
    tripInfos: Record<string, TripInfo[]> | TripInfo[],
    tripType: TripType = 'ONE_WAY'
): TransformedFlight[] {
    if (!tripInfos) {
        return [];
    }

    const flights: TransformedFlight[] = [];

    if (Array.isArray(tripInfos)) {
        flights.push(...transformOneWayFlights(tripInfos));
    } else {
        for (const [key, tripInfoArray] of Object.entries(tripInfos)) {
            if (Array.isArray(tripInfoArray)) {
                if (tripType === 'RETURN') {
                    flights.push(...transformReturnFlights(tripInfoArray, key));
                } else {
                    flights.push(...transformMultiCityFlights(tripInfoArray, key));
                }
            }
        }
    }

    return flights;
}

/**
 * Transform One-way flights
 */
function transformOneWayFlights(tripInfos: TripInfo[]): TransformedFlight[] {
    return tripInfos.map((tripInfo, index) => {
        const segment = tripInfo.sI[0];
        const fareOptions = transformFareOptions(tripInfo.totalPriceList, segment.id, 'ONEWAY');

        const departureDate = new Date(segment.dt);
        const arrivalDate = new Date(segment.at);

        return {
            flightId: `${segment.fD.aI.code}_${segment.fD.fN}_${index}`,
            segmentId: segment.id,
            tripType: 'ONE_WAY',
            legNumber: 0,
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
            fareOptions,
            isInternational: segment.iand,
            isRedEye: segment.isRs,
        };
    });
}

/**
 * Transform Return flights
 */
function transformReturnFlights(tripInfos: TripInfo[], legKey: string): TransformedFlight[] {
    return tripInfos.map((tripInfo, index) => {
        const segment = tripInfo.sI[0];
        const fareOptions = transformFareOptions(tripInfo.totalPriceList, segment.id, 'RETURN');

        const departureDate = new Date(segment.dt);
        const arrivalDate = new Date(segment.at);

        // Determine if it's outbound or return leg
        const isOutbound = legKey === 'ONWARD' || legKey === '0';
        const legNumber = isOutbound ? 1 : 2;

        return {
            flightId: `${segment.fD.aI.code}_${segment.fD.fN}_${legKey}_${index}`,
            segmentId: segment.id,
            tripType: 'RETURN',
            legNumber,
            legKey,
            isOutbound,
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
            fareOptions,
            isInternational: segment.iand,
            isRedEye: segment.isRs,
        };
    });
}

/**
 * Transform Multi-city flights
 */
function transformMultiCityFlights(tripInfos: TripInfo[], legIndex: string): TransformedFlight[] {
    return tripInfos.map((tripInfo, index) => {
        const segment = tripInfo.sI[0];
        const fareOptions = transformFareOptions(tripInfo.totalPriceList, segment.id, 'MULTI_CITY');

        const departureDate = new Date(segment.dt);
        const arrivalDate = new Date(segment.at);

        return {
            flightId: `${segment.fD.aI.code}_${segment.fD.fN}_leg${legIndex}_${index}`,
            segmentId: segment.id,
            tripType: 'MULTI_CITY',
            legNumber: parseInt(legIndex) + 1,
            legIndex: parseInt(legIndex),
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
            fareOptions,
            isInternational: segment.iand,
            isRedEye: segment.isRs,
        };
    });
}

/**
 * Transform fare options for a specific flight segment
 * Handles ADULT, CHILD, INFANT pricing
 */
function transformFareOptions(
    totalPriceList: FareDetail[],
    segmentId: string,
    tripType: string
): TransformedFlight['fareOptions'] {
    return totalPriceList.map((fare) => {
        const adultFare = fare.fd.ADULT;
        const childFare = fare.fd.CHILD;
        const infantFare = fare.fd.INFANT;
        const fareBreakdown = adultFare.afC?.TAF;

        // Get baggage info for this segment
        const segmentBaggage = fare.tai?.tbi?.[segmentId]?.[0]?.ADULT || adultFare.bI;
        const childBaggage = fare.tai?.tbi?.[segmentId]?.[1]?.CHILD || childFare?.bI;
        const infantBaggage = fare.tai?.tbi?.[segmentId]?.[2]?.INFANT;

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
                checked: segmentBaggage?.iB || adultFare.bI.iB,
                cabin: segmentBaggage?.cB || adultFare.bI.cB,
            },
            seatAvailability: adultFare.sR,
            passengerFares: {
                adult: {
                    baseFare: adultFare.fC.BF,
                    taxesAndFees: adultFare.fC.TAF,
                    totalFare: adultFare.fC.TF,
                    netFare: adultFare.fC.NF,
                },
                child: childFare ? {
                    baseFare: childFare.fC.BF,
                    taxesAndFees: childFare.fC.TAF,
                    totalFare: childFare.fC.TF,
                    netFare: childFare.fC.NF,
                    baggage: {
                        checked: childBaggage?.iB || childFare.bI.iB,
                        cabin: childBaggage?.cB || childFare.bI.cB,
                    }
                } : undefined,
                infant: infantFare ? {
                    baseFare: infantFare.fC.BF,
                    taxesAndFees: infantFare.fC.TAF,
                    totalFare: infantFare.fC.TF,
                    netFare: infantFare.fC.NF,
                    baggage: {
                        checked: infantBaggage?.iB || infantFare.bI.iB,
                        cabin: infantBaggage?.cB || infantFare.bI.cB,
                    }
                } : undefined,
            },
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
    tripInfos: Record<string, TripInfo[]> | TripInfo[],
    flightId: string
): TransformedFlight | null {
    const allFlights = transformFlightsForDisplay(tripInfos, 'ONE_WAY');
    return allFlights.find(flight => flight.flightId === flightId) || null;
}


/**
 * Get flight list for display (One-way, Return, Multi-city)
 */
export function getFlightList(
    tripInfos: Record<string, TripInfo[]> | TripInfo[],
    tripType: TripType = 'ONE_WAY'
) {
    console.log("getFlightList - Trip Type:", tripType);
    console.log("getFlightList - tripInfos type:", Array.isArray(tripInfos) ? 'array' : 'object');

    if (tripType === 'ONE_WAY' && Array.isArray(tripInfos)) {
        const flights: TransformedFlight[] = [];

        tripInfos.forEach((tripInfo, index) => {
            const segments = tripInfo.sI || [];
            const totalStops = segments.length - 1;
            const firstSegment = segments[0];
            const lastSegment = segments[segments.length - 1];
            const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
            const isInternational = segments.some(seg => seg.iand === true);
            const isRedEye = segments.some(seg => seg.isRs === true);

            flights.push({
                flightId: `FLIGHT_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                segmentId: segments.map(s => s.id).join(','),
                airline: {
                    code: firstSegment?.fD?.aI?.code || '',
                    name: firstSegment?.fD?.aI?.name || '',
                    isLcc: firstSegment?.fD?.aI?.isLcc || false,
                },
                flightNumber: segments.map(s => s.fD?.fN).join(', '),
                aircraftType: segments.map(s => s.fD?.eT).join(', '),
                departure: {
                    airportCode: firstSegment?.da?.code || '',
                    airportName: firstSegment?.da?.name || '',
                    cityCode: firstSegment?.da?.cityCode || '',
                    city: firstSegment?.da?.city || '',
                    terminal: firstSegment?.da?.terminal,
                    time: firstSegment?.dt || '',
                    date: firstSegment?.dt || '',
                    datetime: firstSegment?.dt,
                },
                arrival: {
                    airportCode: lastSegment?.aa?.code || '',
                    airportName: lastSegment?.aa?.name || '',
                    cityCode: lastSegment?.aa?.cityCode || '',
                    city: lastSegment?.aa?.city || '',
                    terminal: lastSegment?.aa?.terminal,
                    time: lastSegment?.at || '',
                    date: lastSegment?.at || '',
                    datetime: lastSegment?.at,
                },
                duration: totalDuration,
                stops: totalStops,
                fareOptions: (tripInfo.totalPriceList || []).map(fare => {
                    const adultFare = fare.fd?.ADULT;
                    return {
                        id: fare.id,
                        fareIdentifier: fare.fareIdentifier,
                        cabinClass: adultFare?.cc || 'ECONOMY',
                        bookingClass: adultFare?.cB || '',
                        fareBasis: adultFare?.fB || '',
                        baseFare: adultFare?.fC?.BF || 0,
                        taxesAndFees: adultFare?.fC?.TAF || 0,
                        totalFare: adultFare?.fC?.TF || 0,
                        netFare: adultFare?.fC?.NF || 0,
                        refundable: adultFare?.rT === 1,
                        baggage: {
                            checked: adultFare?.bI?.iB || 'Not Specified',
                            cabin: adultFare?.bI?.cB || 'Not Specified',
                        },
                        seatAvailability: adultFare?.sR || 0,
                        isCorporateFare: fare.icca || false,
                    };
                }),
                isInternational,
                isRedEye,
                isOutbound: true, // For ONE_WAY, all flights are outbound
            });
        });

        console.log(`Transformed ${flights.length} ONE_WAY flights`);
        return flights;
    }

    if (tripType === 'RETURN' && !Array.isArray(tripInfos)) {
        const onwardFlights = transformFlightSegments(tripInfos.ONWARD || [], true);
        const returnFlights = transformFlightSegments(tripInfos.RETURN || [], false);

        console.log(`ONWARD flights: ${onwardFlights.length}, RETURN flights: ${returnFlights.length}`);

        if (onwardFlights.length === 0 || returnFlights.length === 0) {
            return [];
        }

        const combinations = [];

        for (const onward of onwardFlights) {
            const onwardLowestFare = Math.min(...onward.fareOptions.map(f => f.netFare));
            const onwardBestFare = onward.fareOptions.reduce((prev, current) =>
                prev.netFare < current.netFare ? prev : current
            );

            for (const returnFlight of returnFlights) {
                const returnLowestFare = Math.min(...returnFlight.fareOptions.map(f => f.netFare));
                const returnBestFare = returnFlight.fareOptions.reduce((prev, current) =>
                    prev.netFare < current.netFare ? prev : current
                );

                combinations.push({
                    combinationId: `${onward.flightId}_${returnFlight.flightId}`,
                    totalFare: onwardLowestFare + returnLowestFare,
                    currency: 'INR',
                    onward: {
                        flightId: onward.flightId,
                        segmentId: onward.segmentId,
                        airline: onward.airline,
                        flightNumber: onward.flightNumber,
                        aircraftType: onward.aircraftType,
                        departure: onward.departure,
                        arrival: onward.arrival,
                        duration: onward.duration,
                        stops: onward.stops,
                        lowestFare: onwardLowestFare,
                        bestFare: {
                            ...onwardBestFare,
                            fareId: onwardBestFare.id,
                        },
                        fareOptions: onward.fareOptions,
                        fareOptionsCount: onward.fareOptions.length,
                    },
                    return: {
                        flightId: returnFlight.flightId,
                        segmentId: returnFlight.segmentId,
                        airline: returnFlight.airline,
                        flightNumber: returnFlight.flightNumber,
                        aircraftType: returnFlight.aircraftType,
                        departure: returnFlight.departure,
                        arrival: returnFlight.arrival,
                        duration: returnFlight.duration,
                        stops: returnFlight.stops,
                        lowestFare: returnLowestFare,
                        bestFare: {
                            ...returnBestFare,
                            fareId: returnBestFare.id,
                        },
                        fareOptions: returnFlight.fareOptions,
                        fareOptionsCount: returnFlight.fareOptions.length,
                    },
                    fareBreakdown: {
                        baseFare: onwardBestFare.baseFare + returnBestFare.baseFare,
                        taxesAndFees: onwardBestFare.taxesAndFees + returnBestFare.taxesAndFees,
                        totalFare: onwardLowestFare + returnLowestFare,
                    },
                    baggage: {
                        onward: onwardBestFare.baggage,
                        return: returnBestFare.baggage,
                    },
                    isRefundable: onwardBestFare.refundable && returnBestFare.refundable,
                });
            }
        }

        const sortedCombinations = combinations.sort((a, b) => a.totalFare - b.totalFare);
        console.log(`Generated ${sortedCombinations.length} RETURN flight combinations`);
        return sortedCombinations;
    }

    if (tripType === 'MULTI_CITY' && !Array.isArray(tripInfos)) {
        const legs: Record<string, any[]> = {};

        Object.keys(tripInfos).forEach((key, legIndex) => {
            if (key !== 'ONWARD' && key !== 'RETURN') {
                const legFlights = transformFlightSegments(tripInfos[key], true, legIndex);
                legs[key] = legFlights;
            }
        });

        return legs;
    }

    return [];
}

// Helper function to transform flight segments
function transformFlightSegments(
    tripInfoArray: TripInfo[],
    isOutbound: boolean,
    legNumber: number = 0
): TransformedFlight[] {
    const flights: TransformedFlight[] = [];

    tripInfoArray.forEach((tripInfo, index) => {
        const segments = tripInfo.sI || [];
        const totalStops = segments.length - 1;
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
        const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
        const isInternational = segments.some(seg => seg.iand === true);
        const isRedEye = segments.some(seg => seg.isRs === true);

        flights.push({
            flightId: `FLIGHT_${isOutbound ? 'OUT' : 'RET'}_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            segmentId: segments.map(s => s.id).join(','),
            airline: {
                code: firstSegment?.fD?.aI?.code || '',
                name: firstSegment?.fD?.aI?.name || '',
                isLcc: firstSegment?.fD?.aI?.isLcc || false,
            },
            flightNumber: segments.map(s => s.fD?.fN).join(', '),
            aircraftType: segments.map(s => s.fD?.eT).join(', '),
            departure: {
                airportCode: firstSegment?.da?.code || '',
                airportName: firstSegment?.da?.name || '',
                cityCode: firstSegment?.da?.cityCode || '',
                city: firstSegment?.da?.city || '',
                terminal: firstSegment?.da?.terminal,
                time: firstSegment?.dt || '',
                date: firstSegment?.dt || '',
                datetime: firstSegment?.dt,
            },
            arrival: {
                airportCode: lastSegment?.aa?.code || '',
                airportName: lastSegment?.aa?.name || '',
                cityCode: lastSegment?.aa?.cityCode || '',
                city: lastSegment?.aa?.city || '',
                terminal: lastSegment?.aa?.terminal,
                time: lastSegment?.at || '',
                date: lastSegment?.at || '',
                datetime: lastSegment?.at,
            },
            duration: totalDuration,
            stops: totalStops,
            fareOptions: (tripInfo.totalPriceList || []).map(fare => {
                const adultFare = fare.fd?.ADULT;
                return {
                    id: fare.id,
                    fareIdentifier: fare.fareIdentifier,
                    cabinClass: adultFare?.cc || 'ECONOMY',
                    bookingClass: adultFare?.cB || '',
                    fareBasis: adultFare?.fB || '',
                    baseFare: adultFare?.fC?.BF || 0,
                    taxesAndFees: adultFare?.fC?.TAF || 0,
                    totalFare: adultFare?.fC?.TF || 0,
                    netFare: adultFare?.fC?.NF || 0,
                    refundable: adultFare?.rT === 1,
                    baggage: {
                        checked: adultFare?.bI?.iB || 'Not Specified',
                        cabin: adultFare?.bI?.cB || 'Not Specified',
                    },
                    seatAvailability: adultFare?.sR || 0,
                    isCorporateFare: fare.icca || false,
                };
            }),
            isInternational,
            isRedEye,
            isOutbound,
            legNumber,
            legKey: isOutbound ? 'ONWARD' : 'RETURN',
            legIndex: index,
        });
    });

    return flights;
}

export function getFlightBySegmentId(
    tripInfos: Record<string, TripInfo[]> | TripInfo[],
    segmentId: string
) {
    const allFlights = transformFlightsForDisplay(tripInfos, 'ONE_WAY');
    return allFlights.find(flight => flight.segmentId === segmentId) || null;
}