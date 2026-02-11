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
 * Get all flights with basic info (for listing)
 * @param tripInfos All trip information from API
 * @returns Array of flights with essential info only
 */
/**
 * Get flight list for display (One-way, Return, Multi-city)
 */
export function getFlightList(
    tripInfos: Record<string, TripInfo[]> | TripInfo[],
    tripType: TripType = 'ONE_WAY'
): any[] {

    console.log("getFlightList - Trip Type:", tripType);
    console.log("getFlightList - tripInfos type:", Array.isArray(tripInfos) ? 'array' : 'object');

    const transformedFlights = transformFlightsForDisplay(tripInfos, tripType);
    console.log(`Transformed ${transformedFlights.length} flights for ${tripType}`);

    if (tripType === 'ONE_WAY') {
        return transformedFlights.map(flight => ({
            flightId: flight.flightId,
            segmentId: flight.segmentId,
            airline: {
                code: flight.airline.code,
                name: flight.airline.name,
            },
            flightNumber: flight.flightNumber,
            departure: {
                airportCode: flight.departure.airportCode,
                time: flight.departure.time,
            },
            arrival: {
                airportCode: flight.arrival.airportCode,
                time: flight.arrival.time,
            },
            duration: flight.duration,
            stops: flight.stops,
            lowestFare: Math.min(...flight.fareOptions.map(f => f.netFare)),
            fareOptionsCount: flight.fareOptions.length,
        }));
    }
    else if (tripType === 'RETURN') {
        
        const outboundFlights = transformedFlights.filter(f => f.isOutbound === true);
        const returnFlights = transformedFlights.filter(f => f.isOutbound === false);

        console.log(`Outbound flights: ${outboundFlights.length}, Return flights: ${returnFlights.length}`);

        
        if (outboundFlights.length === 0 || returnFlights.length === 0) {
            return [];
        }

        
        const combinations = [];

        for (const outbound of outboundFlights) {
        
            const outboundLowestFare = Math.min(...outbound.fareOptions.map(f => f.netFare));

            
            const outboundBestFare = outbound.fareOptions.reduce((prev, current) =>
                prev.netFare < current.netFare ? prev : current
            );

            for (const returnFlight of returnFlights) {
                const returnLowestFare = Math.min(...returnFlight.fareOptions.map(f => f.netFare));

                const returnBestFare = returnFlight.fareOptions.reduce((prev, current) =>
                    prev.netFare < current.netFare ? prev : current
                );

                
                const totalFare = outboundLowestFare + returnLowestFare;

                combinations.push({
                    combinationId: `${outbound.flightId}_${returnFlight.flightId}`,
                    totalFare,
                    currency: 'INR',

                    outbound: {
                        flightId: outbound.flightId,
                        segmentId: outbound.segmentId,
                        airline: {
                            code: outbound.airline.code,
                            name: outbound.airline.name,
                            isLcc: outbound.airline.isLcc,
                        },
                        flightNumber: outbound.flightNumber,
                        aircraftType: outbound.aircraftType,
                        departure: {
                            airportCode: outbound.departure.airportCode,
                            airportName: outbound.departure.airportName,
                            cityCode: outbound.departure.cityCode,
                            city: outbound.departure.city,
                            terminal: outbound.departure.terminal,
                            time: outbound.departure.time,
                            date: outbound.departure.date,
                        },
                        arrival: {
                            airportCode: outbound.arrival.airportCode,
                            airportName: outbound.arrival.airportName,
                            cityCode: outbound.arrival.cityCode,
                            city: outbound.arrival.city,
                            terminal: outbound.arrival.terminal,
                            time: outbound.arrival.time,
                            date: outbound.arrival.date,
                        },
                        duration: outbound.duration,
                        stops: outbound.stops,
                        lowestFare: outboundLowestFare,
                        bestFare: outboundBestFare,
                        fareOptions: outbound.fareOptions,
                        fareOptionsCount: outbound.fareOptions.length,
                    },

                    return: {
                        flightId: returnFlight.flightId,
                        segmentId: returnFlight.segmentId,
                        airline: {
                            code: returnFlight.airline.code,
                            name: returnFlight.airline.name,
                            isLcc: returnFlight.airline.isLcc,
                        },
                        flightNumber: returnFlight.flightNumber,
                        aircraftType: returnFlight.aircraftType,
                        departure: {
                            airportCode: returnFlight.departure.airportCode,
                            airportName: returnFlight.departure.airportName,
                            cityCode: returnFlight.departure.cityCode,
                            city: returnFlight.departure.city,
                            terminal: returnFlight.departure.terminal,
                            time: returnFlight.departure.time,
                            date: returnFlight.departure.date,
                        },
                        arrival: {
                            airportCode: returnFlight.arrival.airportCode,
                            airportName: returnFlight.arrival.airportName,
                            cityCode: returnFlight.arrival.cityCode,
                            city: returnFlight.arrival.city,
                            terminal: returnFlight.arrival.terminal,
                            time: returnFlight.arrival.time,
                            date: returnFlight.arrival.date,
                        },
                        duration: returnFlight.duration,
                        stops: returnFlight.stops,
                        lowestFare: returnLowestFare,
                        bestFare: returnBestFare,
                        fareOptions: returnFlight.fareOptions,
                        fareOptionsCount: returnFlight.fareOptions.length,
                    },


                    passengers: {
                        adult: outboundBestFare.passengerFares?.adult || null,
                        child: outboundBestFare.passengerFares?.child || null,
                        infant: outboundBestFare.passengerFares?.infant || null,
                    },

                    fareBreakdown: {
                        baseFare: outboundBestFare.baseFare + returnBestFare.baseFare,
                        taxesAndFees: outboundBestFare.taxesAndFees + returnBestFare.taxesAndFees,
                        totalFare: totalFare,
                    },

                    baggage: {
                        outbound: outboundBestFare.baggage,
                        return: returnBestFare.baggage,
                    },

                    isRefundable: outboundBestFare.refundable && returnBestFare.refundable,
                });
            }
        }

        const sortedCombinations = combinations.sort((a, b) => a.totalFare - b.totalFare);

        console.log(`Generated ${sortedCombinations.length} return flight combinations`);

        return sortedCombinations;
    }

    else {
        const legs: Record<number, any[]> = {};

        transformedFlights.forEach(flight => {
            const legNum = flight.legNumber || 1;
            if (!legs[legNum]) {
                legs[legNum] = [];
            }

            legs[legNum].push({
                flightId: flight.flightId,
                segmentId: flight.segmentId,
                legNumber: flight.legNumber,
                legIndex: flight.legIndex,
                airline: {
                    code: flight.airline.code,
                    name: flight.airline.name,
                },
                flightNumber: flight.flightNumber,
                departure: {
                    airportCode: flight.departure.airportCode,
                    airportName: flight.departure.airportName,
                    time: flight.departure.time,
                    date: flight.departure.date,
                },
                arrival: {
                    airportCode: flight.arrival.airportCode,
                    airportName: flight.arrival.airportName,
                    time: flight.arrival.time,
                    date: flight.arrival.date,
                },
                duration: flight.duration,
                stops: flight.stops,
                lowestFare: Math.min(...flight.fareOptions.map(f => f.netFare)),
                fareOptions: flight.fareOptions,
                fareOptionsCount: flight.fareOptions.length,
            });
        });

        // Convert to array of legs
        const result = Object.keys(legs)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(legNum => ({
                legNumber: parseInt(legNum),
                flights: legs[parseInt(legNum)]
            }));

        console.log("Multi-city legs result:", result.length);
        return result;
    }
}

export function getFlightBySegmentId(
    tripInfos: Record<string, TripInfo[]> | TripInfo[],
    segmentId: string
) {
    const allFlights = transformFlightsForDisplay(tripInfos, 'ONE_WAY');
    return allFlights.find(flight => flight.segmentId === segmentId) || null;
}