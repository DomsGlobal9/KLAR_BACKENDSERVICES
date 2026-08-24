import { envConfig } from "../config";

export class BaseFlightNormalizer {

    static getFlightKey(segments: any[]): string {
        return segments.map((seg: any) => seg.id).join("-");
    }

    static getTime(dt: string): string {
        return dt?.split("T")[1]?.slice(0, 5);
    }

    static getDateParts(dt: string) {
        const d = new Date(dt);

        const day = d.toLocaleDateString("en-US", { weekday: "long" });

        const dd = d.toLocaleDateString("en-GB", { day: "2-digit" });
        const mm = d.toLocaleDateString("en-US", { month: "short" });
        const yy = d.getFullYear().toString().slice(2);

        return {
            day,
            date: `${dd}-${mm}-${yy}`
        };
    }

    static formatDuration(min: number): string {
        if (!min && min !== 0) return "0h 0m";

        const h = Math.floor(min / 60);
        const m = min % 60;

        return `${h}h ${m}m`;
    }

    static getCheapestFare(totalPriceList: any[]) {
        if (!Array.isArray(totalPriceList) || totalPriceList.length === 0) {
            return undefined;
        }

        const cheapest = totalPriceList.reduce((min, curr) => {
            return curr.fd.ADULT.fC.TF < min.fd.ADULT.fC.TF ? curr : min;
        });

        if (cheapest && envConfig.PLATFORM_MARKUP.ENABLED) {
            const originalPrice = cheapest.fd.ADULT.fC.TF;
            let markupAmount = 0;

            if (envConfig.PLATFORM_MARKUP.TYPE === 'PERCENTAGE') {
                markupAmount = originalPrice * (envConfig.PLATFORM_MARKUP.VALUE / 100);
            } else {
                markupAmount = envConfig.PLATFORM_MARKUP.VALUE;
            }

            cheapest.fd.ADULT.fC.originalTF = originalPrice;
            cheapest.fd.ADULT.fC.TF = originalPrice + markupAmount;

            cheapest.fd.ADULT.fC.markup = markupAmount;
            cheapest.fd.ADULT.fC.markupType = envConfig.PLATFORM_MARKUP.TYPE;
            cheapest.fd.ADULT.fC.markupValue = envConfig.PLATFORM_MARKUP.VALUE;
        }

        return cheapest;
    }

    static extractFares(flights: any[]) {
        return flights.map((flight: any) => {
            return {
                flightKey: this.getFlightKey(flight.sI),

                segments: flight.sI.map((seg: any) => ({
                    ...seg
                })),

                fares: (flight.totalPriceList || []).map((fare: any) => ({
                    ...fare,

                    fareId: fare.id,
                    fareIdentifier: fare.fareIdentifier,
                    fareType: fare.ft || fare.pft || fare.fareIdentifier || 'REGULAR',
                    ft: fare.ft || fare.pft || 'REGULAR',

                    passengerBreakup: {
                        ADULT: fare.fd?.ADULT || null,
                        CHILD: fare.fd?.CHILD || null,
                        INFANT: fare.fd?.INFANT || null
                    },

                    priceSummary: {
                        ADULT: {
                            total: fare.fd?.ADULT?.fC?.TF,
                            baseFare: fare.fd?.ADULT?.fC?.BF,
                            tax: fare.fd?.ADULT?.fC?.TAF,
                            netFare: fare.fd?.ADULT?.fC?.NF
                        },
                        CHILD: {
                            total: fare.fd?.CHILD?.fC?.TF,
                            baseFare: fare.fd?.CHILD?.fC?.BF,
                            tax: fare.fd?.CHILD?.fC?.TAF,
                            netFare: fare.fd?.CHILD?.fC?.NF
                        },
                        INFANT: {
                            total: fare.fd?.INFANT?.fC?.TF,
                            baseFare: fare.fd?.INFANT?.fC?.BF,
                            tax: fare.fd?.INFANT?.fC?.TAF,
                            netFare: fare.fd?.INFANT?.fC?.NF
                        }
                    },

                    baggageDetails: fare.tai?.tbi || null,

                    meta: {
                        isCreditCardApplicable: fare.icca,
                        messages: fare.messages,
                        msri: fare.msri
                    }
                }))
            };
        });
    }

    static getCheapestFareWithBreakdown(totalPriceList: any[]): {
        cheapestFare: any;
        adultPrice: number;
        childPrice: number;
        infantPrice: number;
    } {
        const cheapestFare = this.getCheapestFare(totalPriceList);

        return {
            cheapestFare,
            adultPrice: cheapestFare?.fd?.ADULT?.fC?.TF || 0,
            childPrice: cheapestFare?.fd?.CHILD?.fC?.TF || 0,
            infantPrice: cheapestFare?.fd?.INFANT?.fC?.TF || 0
        };
    }

    static extractFaresForCombo(combo: any) {
        return [{
            flightKey: null,
            segments: (combo.sI || []).map((seg: any) => ({ ...seg })),
            fares: (combo.totalPriceList || []).map((fare: any) => ({
                ...fare,
                fareId: fare.id,
                fareIdentifier: fare.fareIdentifier,
                fareType: fare.ft || fare.pft || fare.fareIdentifier || 'REGULAR',
                ft: fare.ft || fare.pft || 'REGULAR',
                passengerBreakup: {
                    ADULT: fare.fd?.ADULT || null,
                    CHILD: fare.fd?.CHILD || null,
                    INFANT: fare.fd?.INFANT || null
                },
                priceSummary: {
                    ADULT: {
                        total: fare.fd?.ADULT?.fC?.TF,
                        baseFare: fare.fd?.ADULT?.fC?.BF,
                        tax: fare.fd?.ADULT?.fC?.TAF,
                        netFare: fare.fd?.ADULT?.fC?.NF
                    },
                    CHILD: {
                        total: fare.fd?.CHILD?.fC?.TF,
                        baseFare: fare.fd?.CHILD?.fC?.BF,
                        tax: fare.fd?.CHILD?.fC?.TAF,
                        netFare: fare.fd?.CHILD?.fC?.NF
                    },
                    INFANT: {
                        total: fare.fd?.INFANT?.fC?.TF,
                        baseFare: fare.fd?.INFANT?.fC?.BF,
                        tax: fare.fd?.INFANT?.fC?.TAF,
                        netFare: fare.fd?.INFANT?.fC?.NF
                    }
                },
                baggageDetails: fare.tai?.tbi || null,
                meta: {
                    isCreditCardApplicable: fare.icca,
                    messages: fare.messages,
                    msri: fare.msri
                }
            }))
        }];
    }

    static extractMultiFaresForCombo(combo: any) {
        if (!combo.totalPriceList || combo.totalPriceList.length === 0) {
            return [];
        }

        return [{
            flightKey: this.getFlightKey(combo.sI || []),
            segments: (combo.sI || []).map((seg: any) => ({ ...seg })),
            fares: combo.totalPriceList.map((fare: any) => ({
                ...fare,
                fareId: fare.id,
                fareIdentifier: fare.fareIdentifier,
                fareType: fare.ft || fare.pft || fare.fareIdentifier || 'REGULAR',
                ft: fare.ft || fare.pft || 'REGULAR',
                passengerBreakup: {
                    ADULT: fare.fd?.ADULT || null,
                    CHILD: fare.fd?.CHILD || null,
                    INFANT: fare.fd?.INFANT || null
                },
                priceSummary: {
                    ADULT: {
                        total: fare.fd?.ADULT?.fC?.TF,
                        baseFare: fare.fd?.ADULT?.fC?.BF,
                        tax: fare.fd?.ADULT?.fC?.TAF,
                        netFare: fare.fd?.ADULT?.fC?.NF
                    },
                    CHILD: {
                        total: fare.fd?.CHILD?.fC?.TF,
                        baseFare: fare.fd?.CHILD?.fC?.BF,
                        tax: fare.fd?.CHILD?.fC?.TAF,
                        netFare: fare.fd?.CHILD?.fC?.NF
                    },
                    INFANT: {
                        total: fare.fd?.INFANT?.fC?.TF,
                        baseFare: fare.fd?.INFANT?.fC?.BF,
                        tax: fare.fd?.INFANT?.fC?.TAF,
                        netFare: fare.fd?.INFANT?.fC?.NF
                    }
                },
                baggageDetails: fare.tai?.tbi || null,
                meta: {
                    isCreditCardApplicable: fare.icca,
                    messages: fare.messages,
                    msri: fare.msri
                }
            }))
        }];
    }
}