/**
 * Regression coverage for the flight P0/P1 fixes.
 *
 * Uses the Node built-in test runner — no new dependencies, matching the
 * pattern already used elsewhere in this repository.
 *   npm test
 *
 * Everything under test here is pure: no network, no MongoDB, no Redis. The
 * TripJack payload shapes are taken from the Air API PDFs so the fixtures
 * exercise the real field names (mapped through TripjackFieldMapper, so SSR
 * `code` appears as `AirlineCode` and segment `id` as `SegmentID`).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { toPaise, paiseEqual, fromPaise } from "../utils/money.util";
import {
    resolveBookingRequirements,
    isReviewExpired,
} from "../utils/reviewConditions.util";
import {
    verifyBookingAmount,
    verifyAndPriceSsr,
    reviewTotalFarePaise,
    BookingVerificationError,
} from "../utils/bookingVerification.util";
import {
    validateBookingPayload,
    BookingValidationError,
} from "../utils/tripjackBookingVerifier";
import { mapToTripjackBooking } from "../utils/mappers/booking.mapper";
import { FrontendBookingPayload } from "../types/booking.types";
import { parseUpfrontSeatError } from "../utils/upfrontSeatError.util";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A reviewed itinerary: one segment, TF 5000.00, with priced meal and baggage. */
const review = (over: any = {}) => ({
    bookingId: "TJS70010000707761",
    totalPriceInfo: {
        totalFareDetail: {
            FareComponents: { TotalFare: 5000, BaseFare: 4000, NetFare: 4800 },
        },
    },
    TripInformation: [
        {
            SegmentInformation: [
                {
                    SegmentID: "SEG1",
                    ssrInfo: {
                        MEAL: [
                            { AirlineCode: "MEAL_VEG", amount: 250, Description: "Veg meal" },
                            { AirlineCode: "MEAL_FREE", Description: "Complimentary" },
                        ],
                        BAGGAGE: [
                            { AirlineCode: "BAG_5KG", amount: 1200, Description: "5kg extra" },
                        ],
                    },
                },
            ],
        },
    ],
    searchQuery: { routeInfos: [{ travelDate: "2026-10-01" }] },
    conditions: {},
    ...over,
});

/** Seat map as returned by /fms/v1/seat, post field-mapping. */
const seatMap = () => ({
    tripSeatMap: {
        tripSeat: {
            SEG1: {
                sInfo: [
                    { seatNo: "12A", AirlineCode: "SEAT_12A", amount: 500, isBooked: false },
                    { seatNo: "12B", AirlineCode: "SEAT_12B", amount: 500, isBooked: true },
                    { seatNo: "14C", AirlineCode: "SEAT_14C", isBooked: false },
                ],
            },
        },
    },
});

const traveller = (over: any = {}) => ({
    title: "Mr",
    paxType: "ADULT" as const,
    firstName: "Rahul",
    lastName: "Sharma",
    dob: "1994-06-15",
    ...over,
});

const bookingPayload = (over: any = {}): FrontendBookingPayload => ({
    bookingId: "TJS70010000707761",
    amount: 5000,
    email: "rahul@example.com",
    phone: "+919810000001",
    isHold: false,
    travellers: [traveller()],
    ...over,
});

function expectVerificationError(fn: () => unknown, code: string) {
    try {
        fn();
    } catch (err: any) {
        assert.ok(
            err instanceof BookingVerificationError || err instanceof BookingValidationError,
            `expected a verification error, got ${err?.name}: ${err?.message}`
        );
        assert.equal(err.errorCode, code, `expected ${code}, got ${err.errorCode}: ${err.message}`);
        return;
    }
    assert.fail(`expected ${code} but the call succeeded`);
}

// ─── Money ────────────────────────────────────────────────────────────────────

describe("money handling", () => {
    test("converts rupees to integer paise without float drift", () => {
        assert.equal(toPaise(5000), 500000);
        assert.equal(toPaise(730.0), 73000);
        assert.equal(toPaise("1610.55"), 161055);
        // 0.1 + 0.2 territory: the sum must still be an exact integer
        assert.equal(toPaise(0.1)! + toPaise(0.2)!, toPaise(0.3));
    });

    test("rejects values that are not finite numbers", () => {
        for (const bad of [null, undefined, "", "abc", NaN, Infinity]) {
            assert.equal(toPaise(bad as any), null, `${String(bad)} must not convert`);
        }
    });

    test("round-trips through rupees", () => {
        assert.equal(fromPaise(161055), 1610.55);
    });

    test("tolerates a single paise but nothing larger", () => {
        assert.ok(paiseEqual(500000, 500001));
        assert.ok(!paiseEqual(500000, 500002));
        assert.ok(!paiseEqual(500000, 100));
    });
});

// ─── C-4 conditions resolver ──────────────────────────────────────────────────

describe("C-4 review conditions resolver", () => {
    test("absent conditions require nothing", () => {
        const r = resolveBookingRequirements({ conditions: {} });
        assert.equal(r.passport.required, false);
        assert.equal(r.gst.mandatory, false);
        assert.equal(r.gst.applicable, false);
        assert.equal(r.emergencyContact.required, false);
        assert.equal(r.documentId.mandatory, false);
        assert.equal(r.pan.applicable, false);
        assert.equal(r.hold.allowed, false);
        assert.equal(r.seat.applicable, false);
    });

    test("maps each documented flag to its requirement", () => {
        const r = resolveBookingRequirements({
            conditions: {
                pcs: { pm: true, pped: true, pid: true },
                dob: { adobr: true, cdobr: false, idobr: true },
                gst: { gstappl: true, igm: true },
                iecr: true,
                dc: { ida: true, idm: true },
                ipa: true,
                isa: true,
                isBA: true,
                st: 900,
                sct: "2026-08-16T10:00:00",
            },
        });
        assert.equal(r.passport.required, true);
        assert.equal(r.passport.expiryRequired, true);
        assert.equal(r.passport.issueDateRequired, true);
        assert.deepEqual(r.dob, { adult: true, child: false, infant: true });
        assert.equal(r.gst.mandatory, true);
        assert.equal(r.emergencyContact.required, true);
        assert.equal(r.documentId.mandatory, true);
        assert.equal(r.pan.applicable, true);
        assert.equal(r.seat.applicable, true);
        assert.equal(r.hold.allowed, true);
        assert.equal(r.session.validSeconds, 900);
    });

    test("dobe makes DOB mandatory for every pax type", () => {
        const r = resolveBookingRequirements({
            conditions: { pcs: { dobe: true }, dob: { adobr: false, cdobr: false, idobr: false } },
        });
        assert.deepEqual(r.dob, { adult: true, child: true, infant: true });
    });

    test("igm implies GST is applicable even without gstappl", () => {
        const r = resolveBookingRequirements({ conditions: { gst: { igm: true } } });
        assert.equal(r.gst.applicable, true);
    });

    test("reads conditions from a stored review wrapper", () => {
        const r = resolveBookingRequirements({ mappedData: { conditions: { isBA: true } } });
        assert.equal(r.hold.allowed, true);
    });
});

describe("C-4 review session expiry", () => {
    const req = (st: number | null) =>
        resolveBookingRequirements({ conditions: st === null ? {} : { st } });

    test("a review inside its session window is live", () => {
        const stored = new Date("2026-08-16T10:00:00Z");
        const now = new Date("2026-08-16T10:05:00Z"); // 300s later, window 900s
        assert.equal(isReviewExpired(req(900), stored, now), false);
    });

    test("a review past its session window is expired", () => {
        const stored = new Date("2026-08-16T10:00:00Z");
        const now = new Date("2026-08-16T10:20:00Z"); // 1200s later
        assert.equal(isReviewExpired(req(900), stored, now), true);
    });

    test("an unknown session length never blocks a booking", () => {
        const stored = new Date("2020-01-01T00:00:00Z");
        assert.equal(isReviewExpired(req(null), stored, new Date()), false);
    });
});

// ─── C-1 authoritative amount ─────────────────────────────────────────────────

describe("C-1 authoritative amount verification", () => {
    const base = { review: review(), seatMap: seatMap(), travellers: [] as any[] };

    test("reads the reviewed total fare", () => {
        assert.equal(reviewTotalFarePaise(review()), 500000);
    });

    test("accepts the correct amount", () => {
        const result = verifyBookingAmount({ ...base, clientTripjackAmount: 5000 });
        assert.equal(result.authoritativeAmount, 5000);
        assert.equal(result.ssrTotalPaise, 0);
    });

    test("rejects a lowered amount", () => {
        expectVerificationError(
            () => verifyBookingAmount({ ...base, clientTripjackAmount: 100 }),
            "AMOUNT_MISMATCH"
        );
    });

    test("rejects an inflated amount", () => {
        // Overcharging the customer is a defect too, not just underpaying.
        expectVerificationError(
            () => verifyBookingAmount({ ...base, clientTripjackAmount: 9999 }),
            "AMOUNT_MISMATCH"
        );
    });

    test("rejects a malformed amount", () => {
        for (const bad of [undefined, null, "abc", NaN]) {
            expectVerificationError(
                () => verifyBookingAmount({ ...base, clientTripjackAmount: bad as any }),
                "AMOUNT_MALFORMED"
            );
        }
    });

    test("rejects a missing review", () => {
        expectVerificationError(
            () => verifyBookingAmount({ ...base, review: null, clientTripjackAmount: 5000 }),
            "REVIEW_MISSING"
        );
    });

    test("rejects a review with no readable fare", () => {
        expectVerificationError(
            () =>
                verifyBookingAmount({
                    ...base,
                    review: review({ totalPriceInfo: {} }),
                    clientTripjackAmount: 5000,
                }),
            "REVIEW_FARE_UNREADABLE"
        );
    });

    test("a changed fare makes the old amount invalid", () => {
        // The client still holds 5000 while the stored review now says 6500.
        const changed = review({
            totalPriceInfo: { totalFareDetail: { FareComponents: { TotalFare: 6500 } } },
        });
        expectVerificationError(
            () => verifyBookingAmount({ ...base, review: changed, clientTripjackAmount: 5000 }),
            "AMOUNT_MISMATCH"
        );
        // and the new fare is accepted
        const ok = verifyBookingAmount({ ...base, review: changed, clientTripjackAmount: 6500 });
        assert.equal(ok.authoritativeAmount, 6500);
    });

    test("the amount includes server-priced ancillaries", () => {
        const travellers = [
            {
                ssrMealInfos: [{ key: "SEG1", code: "MEAL_VEG" }],
                ssrBaggageInfos: [{ key: "SEG1", code: "BAG_5KG" }],
                ssrSeatInfos: [{ key: "SEG1", code: "SEAT_12A" }],
            },
        ];
        // 5000 + 250 + 1200 + 500
        const result = verifyBookingAmount({
            ...base,
            travellers,
            clientTripjackAmount: 6950,
        });
        assert.equal(result.authoritativeAmount, 6950);
        assert.equal(result.ssrTotalPaise, 195000);
    });

    test("a tampered SSR price cannot lower the total", () => {
        // Client selects a paid seat but submits the base fare only.
        const travellers = [{ ssrSeatInfos: [{ key: "SEG1", code: "SEAT_12A" }] }];
        expectVerificationError(
            () => verifyBookingAmount({ ...base, travellers, clientTripjackAmount: 5000 }),
            "AMOUNT_MISMATCH"
        );
    });
});

// ─── H-4 SSR verification ─────────────────────────────────────────────────────

describe("H-4 SSR verification", () => {
    test("prices meal, baggage and seat from the authoritative source", () => {
        const total = verifyAndPriceSsr(
            [
                {
                    ssrMealInfos: [{ key: "SEG1", code: "MEAL_VEG" }],
                    ssrBaggageInfos: [{ key: "SEG1", code: "BAG_5KG" }],
                    ssrSeatInfos: [{ key: "SEG1", code: "SEAT_12A" }],
                },
            ],
            review(),
            seatMap()
        );
        assert.equal(total, 195000);
    });

    test("a free meal costs nothing", () => {
        const total = verifyAndPriceSsr(
            [{ ssrMealInfos: [{ key: "SEG1", code: "MEAL_FREE" }] }],
            review(),
            seatMap()
        );
        assert.equal(total, 0);
    });

    test("rejects an SSR code that was never offered", () => {
        expectVerificationError(
            () =>
                verifyAndPriceSsr(
                    [{ ssrMealInfos: [{ key: "SEG1", code: "MEAL_INVENTED" }] }],
                    review(),
                    seatMap()
                ),
            "SSR_CODE_NOT_OFFERED"
        );
    });

    test("rejects an SSR attached to a segment outside this booking", () => {
        expectVerificationError(
            () =>
                verifyAndPriceSsr(
                    [{ ssrMealInfos: [{ key: "SEG_OTHER", code: "MEAL_VEG" }] }],
                    review(),
                    seatMap()
                ),
            "SSR_UNKNOWN_SEGMENT"
        );
    });

    test("rejects a seat that is already booked", () => {
        expectVerificationError(
            () =>
                verifyAndPriceSsr(
                    [{ ssrSeatInfos: [{ key: "SEG1", code: "SEAT_12B" }] }],
                    review(),
                    seatMap()
                ),
            "SSR_SEAT_UNAVAILABLE"
        );
    });

    test("refuses to price a seat with no seat map rather than assuming free", () => {
        expectVerificationError(
            () =>
                verifyAndPriceSsr(
                    [{ ssrSeatInfos: [{ key: "SEG1", code: "SEAT_12A" }] }],
                    review(),
                    null
                ),
            "SSR_SEATMAP_UNAVAILABLE"
        );
    });

    test("rejects a malformed selection", () => {
        expectVerificationError(
            () => verifyAndPriceSsr([{ ssrMealInfos: [{ key: "", code: "" }] }], review(), seatMap()),
            "SSR_MALFORMED"
        );
    });
});

// ─── C-5 GST ──────────────────────────────────────────────────────────────────

describe("C-5 GST conditional validation", () => {
    const withGst = (gst: any) =>
        resolveBookingRequirements({ conditions: { gst } });

    const validGst = {
        gstNumber: "27AAPFU0939F1ZV",
        registeredName: "Klar Travels Private Limited",
        email: "gst@example.com",
        mobile: "9810000001",
        address: "12 MG Road, Bengaluru",
    };

    test("GST not applicable: a booking without GST is accepted", () => {
        validateBookingPayload(bookingPayload(), { requirements: withGst({}) });
    });

    test("GST applicable but optional: absent GST is still accepted", () => {
        validateBookingPayload(bookingPayload(), { requirements: withGst({ gstappl: true }) });
    });

    test("GST mandatory: missing GST is rejected", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(bookingPayload(), {
                    requirements: withGst({ gstappl: true, igm: true }),
                }),
            "GST_REQUIRED"
        );
    });

    test("GST mandatory: a complete block is accepted", () => {
        validateBookingPayload(bookingPayload({ gstInfo: validGst }), {
            requirements: withGst({ gstappl: true, igm: true }),
        });
    });

    test("an invalid GST number is rejected even when GST is optional", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({ gstInfo: { ...validGst, gstNumber: "SHORT" } }),
                    { requirements: withGst({ gstappl: true }) }
                ),
            "GST_NUMBER_INVALID"
        );
    });

    test("registered name is capped at the IATA 35-character limit", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({ gstInfo: { ...validGst, registeredName: "X".repeat(36) } }),
                    { requirements: withGst({ gstappl: true }) }
                ),
            "GST_NAME_TOO_LONG"
        );
    });

    test("address is capped at the IATA 70-character limit", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({ gstInfo: { ...validGst, address: "X".repeat(71) } }),
                    { requirements: withGst({ gstappl: true }) }
                ),
            "GST_ADDRESS_TOO_LONG"
        );
    });

    test("mandatory GST also demands address and mobile", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({ gstInfo: { ...validGst, address: "" } }),
                    { requirements: withGst({ igm: true }) }
                ),
            "GST_ADDRESS_REQUIRED"
        );
    });

    test("a fare identifier alone never makes GST mandatory", () => {
        // The old heuristic keyed off strings like "corporate" in the fare name.
        // With no igm flag the booking must go through regardless.
        validateBookingPayload(
            bookingPayload({ fareIdentifierType: "CORPORATE" } as any),
            { requirements: withGst({}) }
        );
    });
});

// ─── H-6 passport ─────────────────────────────────────────────────────────────

describe("H-6 passport conditional validation", () => {
    const passportReq = (pcs: any) => resolveBookingRequirements({ conditions: { pcs } });

    test("passport is not demanded when the review does not require it", () => {
        validateBookingPayload(bookingPayload(), { requirements: passportReq({}) });
    });

    test("pm alone requires only the passport number", () => {
        expectVerificationError(
            () => validateBookingPayload(bookingPayload(), { requirements: passportReq({ pm: true }) }),
            "PASSPORT_REQUIRED"
        );
        validateBookingPayload(
            bookingPayload({
                travellers: [traveller({ passportNumber: "A1234567", passportNationality: "IN" })],
            }),
            { requirements: passportReq({ pm: true }) }
        );
    });

    test("pped and pid are demanded independently", () => {
        const t = traveller({ passportNumber: "A1234567", passportNationality: "IN" });
        expectVerificationError(
            () =>
                validateBookingPayload(bookingPayload({ travellers: [t] }), {
                    requirements: passportReq({ pm: true, pped: true }),
                }),
            "PASSPORT_EXPIRY_REQUIRED"
        );
        expectVerificationError(
            () =>
                validateBookingPayload(bookingPayload({ travellers: [t] }), {
                    requirements: passportReq({ pm: true, pid: true }),
                }),
            "PASSPORT_ISSUE_DATE_REQUIRED"
        );
    });

    test("a passport expiring within six months of travel is rejected (error 1067)", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [
                            traveller({
                                passportNumber: "A1234567",
                                passportNationality: "IN",
                                passportExpiryDate: "2026-11-01",
                            }),
                        ],
                    }),
                    { requirements: passportReq({ pm: true }), departureDate: "2026-10-01" }
                ),
            "PASSPORT_EXPIRES_TOO_SOON"
        );
    });

    test("a passport valid well beyond six months is accepted", () => {
        validateBookingPayload(
            bookingPayload({
                travellers: [
                    traveller({
                        passportNumber: "A1234567",
                        passportNationality: "IN",
                        passportExpiryDate: "2028-01-01",
                    }),
                ],
            }),
            { requirements: passportReq({ pm: true }), departureDate: "2026-10-01" }
        );
    });

    test("travel cannot precede the passport issue date (error 1068)", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [
                            traveller({
                                passportNumber: "A1234567",
                                passportNationality: "IN",
                                passportIssueDate: "2027-01-01",
                                passportExpiryDate: "2037-01-01",
                            }),
                        ],
                    }),
                    { requirements: passportReq({ pm: true }), departureDate: "2026-10-01" }
                ),
            "PASSPORT_ISSUED_AFTER_TRAVEL"
        );
    });

    test("nationality must be a 2-letter IATA code", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [
                            traveller({ passportNumber: "A1234567", passportNationality: "IND" }),
                        ],
                    }),
                    { requirements: passportReq({ pm: true }) }
                ),
            "PASSPORT_NATIONALITY_INVALID"
        );
    });

    test("a partial passport is mapped rather than silently dropped", () => {
        // The old mapper required all four fields or sent none.
        const mapped = mapToTripjackBooking(
            bookingPayload({
                travellers: [traveller({ passportNumber: "A1234567", passportNationality: "IN" })],
            })
        );
        assert.equal(mapped.travellerInfo[0].pNum, "A1234567");
        assert.equal(mapped.travellerInfo[0].pNat, "IN");
        assert.equal(mapped.travellerInfo[0].pid, undefined);
    });
});

// ─── H-7 / H-8 document id and PAN ────────────────────────────────────────────

describe("H-7/H-8 document id and PAN", () => {
    test("document id is required when the review marks it mandatory", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(bookingPayload(), {
                    requirements: resolveBookingRequirements({
                        conditions: { dc: { ida: true, idm: true } },
                    }),
                }),
            "DOCUMENT_ID_REQUIRED"
        );
    });

    test("document id is optional when only applicable", () => {
        validateBookingPayload(bookingPayload(), {
            requirements: resolveBookingRequirements({ conditions: { dc: { ida: true } } }),
        });
    });

    test("document id and PAN reach the TripJack payload", () => {
        const mapped = mapToTripjackBooking(
            bookingPayload({
                travellers: [traveller({ documentId: "STU-99881", pan: "ABCDE1234F" })],
            })
        );
        assert.equal(mapped.travellerInfo[0].di, "STU-99881");
        assert.equal(mapped.travellerInfo[0].pan, "ABCDE1234F");
    });

    test("a malformed PAN is rejected", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({ travellers: [traveller({ pan: "NOTAPAN" })] }),
                    { requirements: resolveBookingRequirements({ conditions: { ipa: true } }) }
                ),
            "PAN_INVALID"
        );
    });
});

// ─── Traveller rules ──────────────────────────────────────────────────────────

describe("traveller validation", () => {
    const none = resolveBookingRequirements({ conditions: {} });

    test("DOB is demanded only when the review asks for it", () => {
        const noDob = bookingPayload({ travellers: [traveller({ dob: undefined })] });
        validateBookingPayload(noDob, { requirements: none });

        expectVerificationError(
            () =>
                validateBookingPayload(noDob, {
                    requirements: resolveBookingRequirements({
                        conditions: { dob: { adobr: true } },
                    }),
                }),
            "DOB_REQUIRED"
        );
    });

    test("two passengers cannot share a name (error 1010)", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({ travellers: [traveller(), traveller()] }),
                    { requirements: none }
                ),
            "DUPLICATE_PASSENGER_NAME"
        );
    });

    test("infants cannot outnumber adults (error 1001)", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [
                            traveller(),
                            traveller({ firstName: "Baby", paxType: "INFANT", title: "Master" }),
                            traveller({ firstName: "Twin", paxType: "INFANT", title: "Master" }),
                        ],
                    }),
                    { requirements: none }
                ),
            "INFANT_MORE_THAN_ADULT"
        );
    });

    test("children cannot outnumber adults (error 1002)", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [
                            traveller(),
                            traveller({ firstName: "Kid", paxType: "CHILD", title: "Master" }),
                            traveller({ firstName: "Kidtwo", paxType: "CHILD", title: "Master" }),
                        ],
                    }),
                    { requirements: none }
                ),
            "CHILD_MORE_THAN_ADULT"
        );
    });

    test("emergency contact is required only when iecr is set", () => {
        validateBookingPayload(bookingPayload(), { requirements: none });

        expectVerificationError(
            () =>
                validateBookingPayload(bookingPayload(), {
                    requirements: resolveBookingRequirements({ conditions: { iecr: true } }),
                }),
            "EMERGENCY_CONTACT_REQUIRED"
        );

        validateBookingPayload(
            bookingPayload({
                emergencyContact: {
                    name: "Priya Sharma",
                    email: "priya@example.com",
                    phone: "+919810000002",
                },
            }),
            { requirements: resolveBookingRequirements({ conditions: { iecr: true } }) }
        );
    });

    test("titles must match the pax type", () => {
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({ travellers: [traveller({ title: "Master" })] }),
                    { requirements: none }
                ),
            "TITLE_INVALID"
        );
    });
});

// ─── IndiGo Upfront mandatory seat selection ──────────────────────────────────

describe("IndiGo Upfront mandatory seat selection", () => {
    /** A reviewed itinerary whose trip carries ism: true on two segments. */
    const upfrontReview = () => ({
        TripInformation: [
            {
                ism: true,
                SegmentInformation: [{ SegmentID: "SEG1" }, { SegmentID: "SEG2" }],
            },
        ],
        conditions: { isa: true },
    });

    const seatOn = (...segmentIds: string[]) =>
        segmentIds.map((key) => ({ key, code: `SEAT_${key}` }));

    test("ism true marks every segment of that trip mandatory", () => {
        const r = resolveBookingRequirements(upfrontReview());
        assert.equal(r.seat.mandatory, true);
        assert.deepEqual(r.seat.mandatorySegmentIds, ["SEG1", "SEG2"]);
    });

    test("a trip without ism carries no mandate", () => {
        const r = resolveBookingRequirements({
            TripInformation: [{ SegmentInformation: [{ SegmentID: "SEG1" }] }],
            conditions: { isa: true },
        });
        assert.equal(r.seat.mandatory, false);
        assert.deepEqual(r.seat.mandatorySegmentIds, []);
        // seat selection is still offered, just not compulsory
        assert.equal(r.seat.applicable, true);
    });

    test("only the flagged trip's segments are mandatory on a mixed itinerary", () => {
        const r = resolveBookingRequirements({
            TripInformation: [
                { ism: true, SegmentInformation: [{ SegmentID: "OUT1" }] },
                { SegmentInformation: [{ SegmentID: "RET1" }] },
            ],
        });
        assert.deepEqual(r.seat.mandatorySegmentIds, ["OUT1"]);
    });

    test("rejects a booking with no seat on a mandatory segment", () => {
        const req = resolveBookingRequirements(upfrontReview());
        expectVerificationError(
            () => validateBookingPayload(bookingPayload(), { requirements: req }),
            "SEAT_SELECTION_MANDATORY"
        );
    });

    test("rejects a booking seated on only one of two mandatory segments", () => {
        const req = resolveBookingRequirements(upfrontReview());
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [traveller({ ssrSeatInfos: seatOn("SEG1") })],
                    }),
                    { requirements: req }
                ),
            "SEAT_SELECTION_MANDATORY"
        );
    });

    test("accepts a booking seated on every mandatory segment", () => {
        const req = resolveBookingRequirements(upfrontReview());
        validateBookingPayload(
            bookingPayload({
                travellers: [traveller({ ssrSeatInfos: seatOn("SEG1", "SEG2") })],
            }),
            { requirements: req }
        );
    });

    test("every adult and child needs their own seat", () => {
        const req = resolveBookingRequirements(upfrontReview());
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [
                            traveller({ ssrSeatInfos: seatOn("SEG1", "SEG2") }),
                            // child has no seat
                            traveller({
                                firstName: "Kid",
                                paxType: "CHILD",
                                title: "Master",
                            }),
                        ],
                    }),
                    { requirements: req }
                ),
            "SEAT_SELECTION_MANDATORY"
        );
    });

    test("infants are exempt from the seat mandate", () => {
        const req = resolveBookingRequirements(upfrontReview());
        // Infants travel on a lap, so an unseated infant must not block the booking.
        validateBookingPayload(
            bookingPayload({
                travellers: [
                    traveller({ ssrSeatInfos: seatOn("SEG1", "SEG2") }),
                    traveller({ firstName: "Baby", paxType: "INFANT", title: "Master" }),
                ],
            }),
            { requirements: req }
        );
    });

    test("non-Upfront fares are unaffected by the mandate", () => {
        const req = resolveBookingRequirements({
            TripInformation: [{ SegmentInformation: [{ SegmentID: "SEG1" }] }],
        });
        validateBookingPayload(bookingPayload(), { requirements: req });
    });

    test("a seat entry with no code does not satisfy the mandate", () => {
        const req = resolveBookingRequirements(upfrontReview());
        expectVerificationError(
            () =>
                validateBookingPayload(
                    bookingPayload({
                        travellers: [
                            traveller({
                                ssrSeatInfos: [
                                    { key: "SEG1", code: "" },
                                    { key: "SEG2", code: "SEAT_SEG2" },
                                ],
                            }),
                        ],
                    }),
                    { requirements: req }
                ),
            "SEAT_SELECTION_MANDATORY"
        );
    });
});

describe("Upfront seat error translation", () => {
    const tjError = (errCode: string, message: string, details: string) => ({
        status: { success: false, httpStatus: 400 },
        errors: [{ errCode, message, details }],
    });

    test("recognises 12034 insufficient seats from Review", () => {
        const parsed = parseUpfrontSeatError(
            tjError(
                "12034",
                "Mandatory seat is not available for the selected fare type",
                "UPFRONT_SEAT_FAILURE$Indigo Upfront fare is not available due to insufficient seats"
            )
        );
        assert.ok(parsed);
        assert.equal(parsed!.errCode, "12034");
        assert.match(parsed!.userMessage, /not enough seats available/i);
        // the raw prefix must not leak into what the agent reads
        assert.ok(!parsed!.userMessage.includes("UPFRONT_SEAT_FAILURE"));
    });

    test("recognises a seat map lookup failure", () => {
        const parsed = parseUpfrontSeatError(
            tjError(
                "12034",
                "Mandatory seat is not available for the selected fare type",
                "UPFRONT_SEAT_FAILURE$Issue fetching Seat Map API. Pls try again later."
            )
        );
        assert.ok(parsed);
        assert.match(parsed!.userMessage, /could not be confirmed|try again/i);
    });

    test("recognises 8038 seat selection mandatory from Book", () => {
        const parsed = parseUpfrontSeatError(
            tjError(
                "8038",
                "Seat Selection is Mandatory",
                "UPFRONT_SEAT_FAILURE$For upfront fares, seat selection is mandatory for all passengers"
            )
        );
        assert.ok(parsed);
        assert.equal(parsed!.errCode, "8038");
        assert.match(parsed!.userMessage, /seat selection is mandatory/i);
    });

    test("reads the error out of a nested axios payload", () => {
        const parsed = parseUpfrontSeatError({
            response: {
                data: tjError("8038", "Seat Selection is Mandatory", "UPFRONT_SEAT_FAILURE$Seat selection failed while booking."),
            },
        });
        assert.ok(parsed);
        assert.equal(parsed!.errCode, "8038");
    });

    test("leaves unrelated TripJack errors alone", () => {
        assert.equal(parseUpfrontSeatError(tjError("1000", "Request flight is not longer available.", "")), null);
        assert.equal(parseUpfrontSeatError({}), null);
        assert.equal(parseUpfrontSeatError(null), null);
    });
});
