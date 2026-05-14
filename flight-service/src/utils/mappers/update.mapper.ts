export function mapToUpdatePayload(payload: any) {
    const result: any = {
        bookingId: payload.bookingId,
        type: payload.type || "UPDATE",
        remarks: payload.remarks,
    };

    if (payload.trips?.length) {
        result.trips = payload.trips.map((trip: any) => ({
            src: trip.src,
            dest: trip.dest,
            departureDate: trip.departureDate,
            ...(trip.travellers && {
                travellers: trip.travellers.map((t: any) => ({
                    fn: t.firstName,
                    ln: t.lastName,
                })),
            }),
        }));
    }

    return result;
}