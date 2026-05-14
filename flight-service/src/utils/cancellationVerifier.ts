
export function validateCancellationPayload(payload: any) {
    if (!payload.bookingId) throw new Error("bookingId is required");
    if (!payload.remarks) throw new Error("remarks is required");
    if (payload.type !== "CANCELLATION") throw new Error("Invalid type");

    if (payload.trips) {
        payload.trips.forEach((trip: any, index: number) => {
            if (trip.travellers) {
                trip.travellers.forEach((t: any, i: number) => {
                    if (!t.fn || !t.ln) {
                        throw new Error(`Invalid traveller at trip ${index}`);
                    }
                });
            }
        });
    }
}