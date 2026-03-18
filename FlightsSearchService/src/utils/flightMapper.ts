export const mapTripJackResponse = (data: any) => {
    const onwardFlights = data?.searchResult?.tripInfos?.ONWARD || [];

    return onwardFlights.flatMap((flight: any) => {
        const segment = flight.sI[0]; 

        return flight.totalPriceList.map((priceOption: any) => ({

            id: {
                id: segment.id, 
                fareId: priceOption.id 
            },
            flight: {
                name: segment.fD.aI.name,
                code: segment.fD.aI.code,
                number: segment.fD.fN,
                class: priceOption.fd.ADULT.cc,
            },

            route: {
                from: {
                    airport: segment.da.name,
                    city: segment.da.city,
                    code: segment.da.code,
                    date: segment.dt.split("T")[0],
                    time: segment.dt.split("T")[1],
                },
                to: {
                    airport: segment.aa.name,
                    city: segment.aa.city,
                    code: segment.aa.code,
                    date: segment.at.split("T")[0],
                    time: segment.at.split("T")[1],
                },
            },

            duration: segment.duration,
            stops: segment.stops,

            price: {
                adult: priceOption.fd.ADULT?.fC?.TF ?? null,
                child: priceOption.fd.CHILD?.fC?.TF ?? null,
                infant: priceOption.fd.INFANT?.fC?.TF ?? null,
                currency: "INR",
            },

            baggage: {
                cabin: priceOption.fd.ADULT?.bI?.cB,
                checkin: priceOption.fd.ADULT?.bI?.iB,
            },

            fareIdentifier: priceOption.fareIdentifier,
        }));
    });
};
