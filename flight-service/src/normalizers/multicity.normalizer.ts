import { BaseFlightNormalizer } from "./baseFlight.normalizer";

type AnyObj = Record<string, any>;

export class MultiCityNormalizer extends BaseFlightNormalizer {

    static normalize(searchResult: AnyObj) {
        const tripInfos = searchResult?.searchResult?.tripInfos;

        if (!tripInfos) return [];

        const legKeys = Object.keys(tripInfos)
            .sort((a, b) => Number(a) - Number(b));

        return legKeys.map((key) => {
            const flights = tripInfos[key] || [];

            return {
                legIndex: Number(key),

                flights: flights.map((flight: AnyObj) => {

                    const segments = flight.sI || [];

                    const cheapestFare = this.getCheapestFare(
                        flight.totalPriceList || []
                    );

                    return {
                        flightKey: this.getFlightKey(segments),

                        segments: segments.map((seg: AnyObj) => ({
                            id: seg.id,
                            airline: seg.fD?.aI?.code,
                            airlineName: seg.fD?.aI?.name,
                            flightNumber: seg.fD?.fN,
                            aircraft: seg.fD?.eT,

                            stops: seg.stops,
                            duration: seg.duration,

                            departure: {
                                code: seg.da?.code,
                                city: seg.da?.city,
                                terminal: seg.da?.terminal,
                                time: seg.dt,
                                ...this.getDateParts(seg.dt),
                            },

                            arrival: {
                                code: seg.aa?.code,
                                city: seg.aa?.city,
                                terminal: seg.aa?.terminal,
                                time: seg.at,
                                ...this.getDateParts(seg.at),
                            }
                        })),

                        fares: (flight.totalPriceList || []).map((fare: AnyObj) => ({
                            fareId: fare.id,
                            fareIdentifier: fare.fareIdentifier,

                            price: {
                                adult: fare.fd?.ADULT?.fC?.TF ?? 0,
                                child: fare.fd?.CHILD?.fC?.TF ?? 0,
                                infant: fare.fd?.INFANT?.fC?.TF ?? 0
                            },

                            baseFare: {
                                adult: fare.fd?.ADULT?.fC?.BF ?? 0,
                                child: fare.fd?.CHILD?.fC?.BF ?? 0,
                                infant: fare.fd?.INFANT?.fC?.BF ?? 0
                            },

                            tax: {
                                adult: fare.fd?.ADULT?.fC?.TAF ?? 0,
                                child: fare.fd?.CHILD?.fC?.TAF ?? 0,
                                infant: fare.fd?.INFANT?.fC?.TAF ?? 0
                            },

                            baggage: fare.tai?.tbi || null,

                            cabinClass: fare.fd?.ADULT?.cc,

                            bookingClass: fare.fd?.ADULT?.cB
                        })),

                        cheapestFare: cheapestFare
                            ? {
                                fareId: cheapestFare.id,
                                total: cheapestFare.fd?.ADULT?.fC?.TF ?? 0
                            }
                            : null
                    };
                })
            };
        });
    }
}