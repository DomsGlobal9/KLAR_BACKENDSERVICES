

export const filterFlights = (flights: any, filters: any) => {
    let filteredFlights = [...flights];


    if (filters.flightId) {
        filteredFlights = filteredFlights.filter(flight => {
            const flightId = `${flight.flight.code}-${flight.flight.number}`;
            return flightId === filters.flightId;
        });
    }


    if (filters.airlineCode) {
        filteredFlights = filteredFlights.filter(
            flight => flight.flight.code === filters.airlineCode
        );
    }


    if (filters.flightNumber) {
        filteredFlights = filteredFlights.filter(
            flight => flight.flight.number === filters.flightNumber
        );
    }


    if (filters.classType) {
        filteredFlights = filteredFlights.filter(
            flight => flight.flight.class === filters.classType
        );
    }


    if (filters.fareIdentifier) {
        filteredFlights = filteredFlights.filter(
            flight => flight.fareIdentifier === filters.fareIdentifier
        );
    }


    if (filters.minPrice !== undefined) {
        filteredFlights = filteredFlights.filter(
            flight => flight.price.adult >= filters.minPrice!
        );
    }

    if (filters.maxPrice !== undefined) {
        filteredFlights = filteredFlights.filter(
            flight => flight.price.adult <= filters.maxPrice!
        );
    }


    if (filters.departureTime) {
        filteredFlights = filteredFlights.filter(flight => {
            const hour = parseInt(flight.route.from.time.split(':')[0]);

            switch (filters.departureTime!.toLowerCase()) {
                case 'morning':
                    return hour >= 6 && hour < 12;
                case 'afternoon':
                    return hour >= 12 && hour < 17;
                case 'evening':
                    return hour >= 17 && hour < 21;
                case 'night':
                    return hour >= 21 || hour < 6;
                default:
                    return true;
            }
        });
    }


    if (filters.airlineName) {
        filteredFlights = filteredFlights.filter(
            flight => flight.flight.name.toLowerCase().includes(filters.airlineName!.toLowerCase())
        );
    }

    return filteredFlights;
};
