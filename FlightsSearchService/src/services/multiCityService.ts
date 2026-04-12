import { TransformedFlight, FareDetail, FlightSegment } from "../interface/flight/flight.interface";

export function transformMultiCityFlights(tripInfos: Record<string, any[]>): {
    legNumber: number;
    legKey: string;
    flights: TransformedFlight[];
}[] {
    const legs: {
        legNumber: number;
        legKey: string;
        flights: TransformedFlight[];
    }[] = [];

    // Sort leg keys numerically
    const legKeys = Object.keys(tripInfos).sort((a, b) => parseInt(a) - parseInt(b));

    legKeys.forEach((legKey, idx) => {
        const tripInfoArray = tripInfos[legKey];

        if (!Array.isArray(tripInfoArray) || tripInfoArray.length === 0) {
            return;
        }

        const flights: TransformedFlight[] = [];

        tripInfoArray.forEach((tripInfo, flightIndex) => {
            const segments = tripInfo.sI || [];

            if (segments.length === 0) return;

            const transformedFlight = transformSingleMultiCityFlight(
                tripInfo,
                segments,
                legKey,
                flightIndex,
                idx + 1
            );

            flights.push(transformedFlight);
        });

        legs.push({
            legNumber: idx + 1,
            legKey: legKey,
            flights: flights
        });
    });

    return legs;
}

function transformSingleMultiCityFlight(
    tripInfo: any,
    segments: FlightSegment[],
    legKey: string,
    flightIndex: number,
    legNumber: number
): TransformedFlight {
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const totalStops = segments.length - 1;
    const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
    const isInternational = segments.some(seg => seg.iand === true);
    const isRedEye = segments.some(seg => seg.isRs === true);

    const departureDate = new Date(firstSegment.dt);
    const arrivalDate = new Date(lastSegment.at);

    const fareOptions = transformMultiCityFareOptions(tripInfo.totalPriceList, segments);

    return {
        flightId: `${firstSegment.fD.aI.code}_${firstSegment.fD.fN}_leg${legKey}_${flightIndex}_${Date.now()}`,
        segmentId: segments.map(s => s.id).join(','),
        tripType: 'MULTI_CITY',
        legNumber: legNumber,
        legIndex: parseInt(legKey),
        legKey: legKey,
        airline: {
            code: firstSegment.fD.aI.code,
            name: firstSegment.fD.aI.name,
            isLcc: firstSegment.fD.aI.isLcc,
        },
        flightNumber: segments.map(s => s.fD.fN).join(', '),
        aircraftType: segments.map(s => s.fD.eT).join(', '),
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
        fareOptions,
        isInternational,
        isRedEye,
    };
}

function transformMultiCityFareOptions(
    totalPriceList: FareDetail[],
    segments: FlightSegment[]
): TransformedFlight['fareOptions'] {
    return totalPriceList.map((fare) => {
        const adultFare = fare.fd.ADULT;
        const childFare = fare.fd.CHILD;
        const infantFare = fare.fd.INFANT;
        const fareBreakdown = adultFare.afC?.TAF;

        // Collect baggage for all segments
        const baggageInfo = collectBaggageInfo(fare, segments);

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
            baggage: baggageInfo.adult,
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
                    baggage: baggageInfo.child,
                } : undefined,
                infant: infantFare ? {
                    baseFare: infantFare.fC.BF,
                    taxesAndFees: infantFare.fC.TAF,
                    totalFare: infantFare.fC.TF,
                    netFare: infantFare.fC.NF,
                    baggage: baggageInfo.infant,
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

function collectBaggageInfo(fare: FareDetail, segments: FlightSegment[]) {
    const adultBaggageParts: string[] = [];
    const adultCabinParts: string[] = [];
    const childBaggageParts: string[] = [];
    const childCabinParts: string[] = [];
    const infantBaggageParts: string[] = [];
    const infantCabinParts: string[] = [];

    segments.forEach((segment) => {
        const adultBaggage = fare.tai?.tbi?.[segment.id]?.[0]?.ADULT;
        if (adultBaggage) {
            adultBaggageParts.push(adultBaggage.iB);
            adultCabinParts.push(adultBaggage.cB);
        }

        const childBaggage = fare.tai?.tbi?.[segment.id]?.[1]?.CHILD;
        if (childBaggage) {
            childBaggageParts.push(childBaggage.iB);
            childCabinParts.push(childBaggage.cB);
        }

        const infantBaggage = fare.tai?.tbi?.[segment.id]?.[2]?.INFANT;
        if (infantBaggage) {
            infantBaggageParts.push(infantBaggage.iB);
            infantCabinParts.push(infantBaggage.cB);
        }
    });

    const adultFare = fare.fd.ADULT;
    const childFare = fare.fd.CHILD;
    const infantFare = fare.fd.INFANT;

    return {
        adult: {
            checked: adultBaggageParts.length > 0 ? adultBaggageParts.join(' → ') : adultFare.bI.iB,
            cabin: adultCabinParts.length > 0 ? adultCabinParts.join(' → ') : adultFare.bI.cB,
        },
        child: childFare ? {
            checked: childBaggageParts.length > 0 ? childBaggageParts.join(' → ') : childFare.bI.iB,
            cabin: childCabinParts.length > 0 ? childCabinParts.join(' → ') : childFare.bI.cB,
        } : undefined,
        infant: infantFare ? {
            checked: infantBaggageParts.length > 0 ? infantBaggageParts.join(' → ') : infantFare.bI.iB,
            cabin: infantCabinParts.length > 0 ? infantCabinParts.join(' → ') : infantFare.bI.cB,
        } : undefined,
    };
}