export function mapToAmendmentPayload(payload: any) {
    const result: any = {
        bookingId: payload.bookingId,
        type: "CANCELLATION",
        remarks: payload.remarks,
    };

    if (payload.travellers?.length) {
        result.trips = [
            {
                travellers: payload.travellers.map((t: any) => ({
                    fn: t.firstName,
                    ln: t.lastName,
                })),
            },
        ];
    }

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