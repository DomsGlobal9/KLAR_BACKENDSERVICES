import { FareDetail, FlightSegment, TransformedFlight } from "../../interface/flight/flight.interface";


export interface MultiCityLeg {
    legNumber: number;
    legKey: string;
    flights: TransformedFlight[];
}

export function transformMultiCityResponse(tripInfos: Record<string, any[]>): MultiCityLeg[] {
    const legs: MultiCityLeg[] = [];

    // Sort leg keys numerically
    const legKeys = Object.keys(tripInfos).sort((a, b) => parseInt(a) - parseInt(b));

    legKeys.forEach((legKey, idx) => {
        const tripInfoArray = tripInfos[legKey];

        if (!Array.isArray(tripInfoArray) || tripInfoArray.length === 0) {
            return;
        }

        const flights: TransformedFlight[] = [];

        tripInfoArray.forEach((tripInfo, flightIdx) => {
            const segments = tripInfo.sI || [];
            if (segments.length === 0) return;

            const firstSegment = segments[0];
            const lastSegment = segments[segments.length - 1];
            const totalDuration = segments.reduce((sum: number, seg: FlightSegment) => sum + (seg.duration || 0), 0);
            const totalStops = segments.length - 1;
            const isInternational = segments.some((seg: FlightSegment) => seg.iand === true);
            const isRedEye = segments.some((seg: FlightSegment) => seg.isRs === true);

            const departureDate = new Date(firstSegment.dt);
            const arrivalDate = new Date(lastSegment.at);

            flights.push({
                flightId: `${firstSegment.fD.aI.code}_${firstSegment.fD.fN}_leg${legKey}_${flightIdx}`,
                segmentId: segments.map((s: FlightSegment) => s.id).join(','),
                tripType: 'MULTI_CITY',
                legNumber: idx + 1,
                legIndex: parseInt(legKey),
                legKey: legKey,
                airline: {
                    code: firstSegment.fD.aI.code,
                    name: firstSegment.fD.aI.name,
                    isLcc: firstSegment.fD.aI.isLcc,
                },
                flightNumber: segments.map((s: FlightSegment) => s.fD.fN).join(', '),
                aircraftType: segments.map((s: FlightSegment) => s.fD.eT).join(', '),
                departure: {
                    airportCode: firstSegment.da.code,
                    airportName: firstSegment.da.name,
                    cityCode: firstSegment.da.cityCode,
                    city: firstSegment.da.city,
                    terminal: firstSegment.da.terminal,
                    time: departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    date: departureDate.toLocaleDateString(),
                    datetime: firstSegment.dt,
                },
                arrival: {
                    airportCode: lastSegment.aa.code,
                    airportName: lastSegment.aa.name,
                    cityCode: lastSegment.aa.cityCode,
                    city: lastSegment.aa.city,
                    terminal: lastSegment.aa.terminal,
                    time: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    date: arrivalDate.toLocaleDateString(),
                    datetime: lastSegment.at,
                },
                duration: totalDuration,
                stops: totalStops,
                fareOptions: transformFareOptions(tripInfo.totalPriceList, segments),
                isInternational,
                isRedEye,
            });
        });

        legs.push({
            legNumber: idx + 1,
            legKey: legKey,
            flights: flights,
        });
    });

    return legs;
}

function transformFareOptions(totalPriceList: FareDetail[], segments: FlightSegment[]): TransformedFlight['fareOptions'] {
    return totalPriceList.map((fare) => {
        const adultFare = fare.fd.ADULT;
        const childFare = fare.fd.CHILD;
        const infantFare = fare.fd.INFANT;
        const fareBreakdown = adultFare.afC?.TAF;

        // Collect baggage for all segments
        let checkedBaggage = '';
        let cabinBaggage = '';

        segments.forEach((segment) => {
            const segmentBaggage = fare.tai?.tbi?.[segment.id]?.[0]?.ADULT;
            if (segmentBaggage) {
                checkedBaggage += (checkedBaggage ? ' → ' : '') + segmentBaggage.iB;
                cabinBaggage += (cabinBaggage ? ' → ' : '') + segmentBaggage.cB;
            }
        });

        if (!checkedBaggage) {
            checkedBaggage = adultFare.bI.iB;
            cabinBaggage = adultFare.bI.cB;
        }

        // Child baggage
        let childCheckedBaggage = '';
        let childCabinBaggage = '';
        if (childFare) {
            segments.forEach((segment) => {
                const childBaggage = fare.tai?.tbi?.[segment.id]?.[1]?.CHILD;
                if (childBaggage) {
                    childCheckedBaggage += (childCheckedBaggage ? ' → ' : '') + childBaggage.iB;
                    childCabinBaggage += (childCabinBaggage ? ' → ' : '') + childBaggage.cB;
                }
            });
            if (!childCheckedBaggage) {
                childCheckedBaggage = childFare.bI.iB;
                childCabinBaggage = childFare.bI.cB;
            }
        }

        // Infant baggage
        let infantCheckedBaggage = '';
        let infantCabinBaggage = '';
        if (infantFare) {
            segments.forEach((segment) => {
                const infantBaggage = fare.tai?.tbi?.[segment.id]?.[2]?.INFANT;
                if (infantBaggage) {
                    infantCheckedBaggage += (infantCheckedBaggage ? ' → ' : '') + infantBaggage.iB;
                    infantCabinBaggage += (infantCabinBaggage ? ' → ' : '') + infantBaggage.cB;
                }
            });
            if (!infantCheckedBaggage) {
                infantCheckedBaggage = infantFare.bI.iB;
                infantCabinBaggage = infantFare.bI.cB;
            }
        }

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
                checked: checkedBaggage,
                cabin: cabinBaggage,
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
                        checked: childCheckedBaggage,
                        cabin: childCabinBaggage,
                    }
                } : undefined,
                infant: infantFare ? {
                    baseFare: infantFare.fC.BF,
                    taxesAndFees: infantFare.fC.TAF,
                    totalFare: infantFare.fC.TF,
                    netFare: infantFare.fC.NF,
                    baggage: {
                        checked: infantCheckedBaggage,
                        cabin: infantCabinBaggage,
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