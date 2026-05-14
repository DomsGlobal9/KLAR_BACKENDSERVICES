export function validateUpdatePayload(payload: any) {
    if (!payload.bookingId) throw new Error("bookingId is required");
    if (!payload.remarks) throw new Error("remarks is required");

    if (payload.trips) {
        payload.trips.forEach((trip: any, index: number) => {
            if (!trip.src || !trip.dest || !trip.departureDate) {
                throw new Error(`Invalid trip at index ${index}`);
            }

            if (trip.travellers) {
                trip.travellers.forEach((t: any, i: number) => {
                    if (!t.firstName || !t.lastName) {
                        throw new Error(`Invalid traveller at trip ${index}`);
                    }
                });
            }
        });
    }
}