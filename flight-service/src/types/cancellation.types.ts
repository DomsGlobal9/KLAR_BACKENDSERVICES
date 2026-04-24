export interface Traveller {
    fn: string;
    ln: string;
}

export interface Trip {
    src: string;
    dest: string;
    departureDate: string;
    travellers: Traveller[];
}

export interface CancellationPayload {
    bookingId: string;
    type: "CANCELLATION";
    remarks: string;
    trips: Trip[];
}

export interface StatusPayload {
    amendmentId: string;
}