import { SegmentResponse, TripInfo, TripJackSearchPayload } from "../interface/flight/flight.interface";
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

        console.log("&&&&&&&&&&&&&&&&\nThe flight data we get", data);

        const tripInfos: TripInfo[] = data.searchResult?.tripInfos?.ONWARD || [];

        console.log("@@@@@@@@@@@@@@@@@@@@\nThe trip info data we got", JSON.stringify(tripInfos, null, 2));


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

        return null; // Segment not found
    } catch (error) {
        console.error("Error fetching flight segment:", error);
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