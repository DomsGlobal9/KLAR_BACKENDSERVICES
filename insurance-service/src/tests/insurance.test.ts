/**
 * Regression coverage for the TripSafe audit fixes (F-03 … F-07).
 *
 * Uses the Node built-in test runner — no new dependencies.
 *   npm test
 *
 * Upstream TripJack is always mocked. Nothing here touches the network,
 * and mongoose buffering is disabled so persistence failures surface
 * immediately instead of waiting on a connection that will never arrive.
 */
import { test, mock, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { searchService } from "../services/search.service";
import { reviewService, extractReviewedAmount } from "../services/review.service";
import {
    bookService,
    detectJourneyType,
    explicitJourneyType,
    assertMatchesReview,
    ageFromDob,
} from "../services/book.service";
import { listService } from "../services/list.service";
import { bookingDetailsService } from "../services/bookingDetails.service";
import { mapUpstreamStatus } from "../services/reconcile.service";
import { tripJackInsuranceProvider, redactForLog } from "../providers/tripjack.insurance.provider";
import { tripJackInsuranceClient } from "../clients/tripjack.client";
import { InsuranceBookingModel, InsuranceJourneyType, InsuranceBookingStatus } from "../models/InsuranceBooking.model";

mongoose.set("bufferCommands", false);

/** Asserts the promise rejects with the given HTTP status (services throw plain objects). */
async function rejectsWith(p: Promise<unknown>, status: number, match?: RegExp) {
    try {
        await p;
    } catch (err: any) {
        assert.equal(err.status, status, `expected status ${status}, got ${err.status}: ${err.message}`);
        if (match) assert.match(String(err.message), match);
        return;
    }
    assert.fail(`expected rejection with status ${status}, but it resolved`);
}

const traveller = () => ({
    id: 1,
    dob: "1994-06-15",
    age: 30,
    fn: "Rahul",
    ln: "Sharma",
    eid: "rahul@example.com",
    pnum: "A1234567",
    cnum: "9810000001",
    gen: "M",
    ni: [{ nn: "Priya Sharma", nr: "SPOUSE" }],
});

const bookPayload = (over: Record<string, any> = {}) => ({
    bookingId: "TJS70010000707761",
    paymentInfos: [{ paymentMedium: "WALLET", amount: 1500 }],
    deliveryInfo: { emails: ["rahul@example.com"], contacts: ["9810000001"] },
    pli: [{ plid: "isid0219009173_0_regular", pi: [{ pid: "ABHI-PLAN_250-WW-AAI-BOXX", iti: [traveller()] }] }],
    ...over,
});

// ─── Search validation ────────────────────────────────────────────────────────

describe("search validation", () => {
    const base = {
        isq: {
            sd: "2026-04-01",
            ed: "2026-04-10",
            isc: { iri: [{ rkey: "US", rt: "COUNTRY" }] },
            iti: [{ age: 30 }],
        },
    };

    test("rejects an empty traveller list", async () => {
        await rejectsWith(searchService.search({ isq: { ...base.isq, iti: [] } }), 400, /traveller/i);
    });

    test("rejects more than 10 travellers", async () => {
        const iti = Array.from({ length: 11 }, () => ({ age: 30 }));
        await rejectsWith(searchService.search({ isq: { ...base.isq, iti } }), 400, /10 travellers/i);
    });

    test("rejects fractional age", async () => {
        await rejectsWith(searchService.search({ isq: { ...base.isq, iti: [{ age: 1.5 }] } }), 400, /integer/i);
    });

    test("rejects blacklisted countries", async () => {
        for (const rkey of ["MM", "IR", "NK"]) {
            await rejectsWith(
                searchService.search({ isq: { ...base.isq, isc: { iri: [{ rkey, rt: "COUNTRY" }] } } }),
                400,
                /blacklisted/i
            );
        }
    });

    test("rejects end date before start date", async () => {
        await rejectsWith(searchService.search({ isq: { ...base.isq, sd: "2026-04-10", ed: "2026-04-01" } }), 400, /end date/i);
    });

    test("rejects coverage longer than 180 days", async () => {
        await rejectsWith(searchService.search({ isq: { ...base.isq, sd: "2026-01-01", ed: "2026-12-31" } }), 400, /180/);
    });

    test("STUDENT is country-only and age 18-45", async () => {
        const student = { ...base.isq, ict: "STUDENT", cd: 180, iti: [{ age: 20 }] };
        await rejectsWith(
            searchService.search({ isq: { ...student, isc: { iri: [{ rkey: "ASI", rt: "POPULARREGION" }] } } }),
            400,
            /COUNTRY only/i
        );
        await rejectsWith(searchService.search({ isq: { ...student, iti: [{ age: 17 }] } }), 400, /18–45/);
        await rejectsWith(searchService.search({ isq: { ...student, cd: 7 } }), 400, /cd must be one of/i);
    });

    test("AMT is region-only with a 30/45/60 day duration", async () => {
        const amt = { ...base.isq, ict: "AMT", adr: 45, isc: { iri: [{ rkey: "ASI", rt: "POPULARREGION" }] } };
        await rejectsWith(
            searchService.search({ isq: { ...amt, isc: { iri: [{ rkey: "US", rt: "COUNTRY" }] } } }),
            400,
            /REGION only/i
        );
        await rejectsWith(searchService.search({ isq: { ...amt, adr: 90 } }), 400, /30, 45, 60/);
    });

    test("a valid standalone search reaches the provider and reports its journey type", async () => {
        const search = mock.method(tripJackInsuranceProvider, "search", async () => ({ searchId: "isid1" }));
        try {
            const res: any = await searchService.search(base);
            assert.equal(res.status, true);
            assert.equal(res.journeyType, "STANDALONE");
            assert.deepEqual(res.body, { searchId: "isid1" });
            // the isq wrapper must be preserved exactly as TripJack expects it
            assert.deepEqual(search.mock.calls[0].arguments[0], base);
        } finally {
            search.mock.restore();
        }
    });
});

// ─── Review validation ────────────────────────────────────────────────────────

describe("review validation", () => {
    test("rejects a payload that is neither standard nor embedded", async () => {
        await rejectsWith(reviewService.review({}), 400, /pli .*or .*embedded/i);
    });

    test("rejects a plan without a product id", async () => {
        await rejectsWith(reviewService.review({ pli: [{ plid: "isid1", pi: [] }] }), 400, /pid/i);
    });

    test("rejects an empty pli", async () => {
        await rejectsWith(reviewService.review({ pli: [] }), 400, /at least one plan/i);
    });

    test("rejects a plan without a plid", async () => {
        await rejectsWith(reviewService.review({ pli: [{ pi: [{ pid: "P1" }] }] }), 400, /plid/i);
    });

    // F-24 — doc p. 21: "we can review only 1 plid, per search"
    test("rejects more than one plan and does not reach TripJack", async () => {
        const review = mock.method(tripJackInsuranceProvider, "review", async () => ({ bid: "TJS1" }));
        try {
            await rejectsWith(
                reviewService.review({
                    pli: [
                        { plid: "isid1", pi: [{ pid: "P1" }] },
                        { plid: "isid2", pi: [{ pid: "P2" }] },
                    ],
                }),
                400,
                /exactly one plan/i
            );
            assert.equal(review.mock.callCount(), 0, "must not reach the upstream review API");
        } finally {
            review.mock.restore();
        }
    });

    test("accepts exactly one plan with one product", async () => {
        const review = mock.method(tripJackInsuranceProvider, "review", async () => ({ bid: "TJS1" }));
        try {
            const res: any = await reviewService.review({ pli: [{ plid: "isid1", pi: [{ pid: "P1" }] }] });
            assert.equal(res.status, true);
            assert.equal(review.mock.callCount(), 1);
        } finally {
            review.mock.restore();
        }
    });

    test("embedded review requires iid, pid, refid, iti and coverage dates", async () => {
        await rejectsWith(reviewService.review({ iid: "isid1", pid: "P1" }), 400, /refid/i);
    });

    test("surfaces the booking id from the review response", async () => {
        const review = mock.method(tripJackInsuranceProvider, "review", async () => ({ bid: "TJS999" }));
        try {
            const res: any = await reviewService.review({ pli: [{ plid: "isid1", pi: [{ pid: "P1" }] }] });
            assert.equal(res.bookingId, "TJS999");
        } finally {
            review.mock.restore();
        }
    });
});

// ─── F-06 payment amount ──────────────────────────────────────────────────────

describe("F-06 payment amount validation", () => {
    for (const [label, amount] of [
        ["zero", 0],
        ["negative", -1500],
        ["non-numeric", "abc"],
        ["missing", undefined],
    ] as const) {
        test(`rejects a ${label} amount before calling TripJack`, async () => {
            const book = mock.method(tripJackInsuranceProvider, "book", async () => ({}));
            try {
                await rejectsWith(
                    bookService.book(bookPayload({ paymentInfos: [{ paymentMedium: "WALLET", amount }] })),
                    400,
                    /amount/i
                );
                assert.equal(book.mock.callCount(), 0, "must not reach the upstream booking API");
            } finally {
                book.mock.restore();
            }
        });
    }

    test("accepts a valid amount and reports the upstream booking id", async () => {
        const book = mock.method(tripJackInsuranceProvider, "book", async () => ({
            order: { bookingId: "TJS70850000729798" },
            status: { success: true },
        }));
        try {
            const res: any = await bookService.book(bookPayload(), "agent-1", "Agent One");
            assert.equal(res.status, true);
            assert.equal(res.bookingId, "TJS70850000729798");
            // no DB in this environment — the flag must say so rather than imply a saved record
            assert.equal(res.persisted, false);
        } finally {
            book.mock.restore();
        }
    });
});

// ─── F-25 book echoes exactly one reviewed plan ───────────────────────────────

describe("F-25 book plan echo", () => {
    test("rejects more than one plan and does not reach TripJack", async () => {
        const book = mock.method(tripJackInsuranceProvider, "book", async () => ({ order: { bookingId: "TJS1" } }));
        try {
            const payload = bookPayload();
            payload.pli = [payload.pli[0], JSON.parse(JSON.stringify(payload.pli[0]))];
            payload.pli[1].plid = "isid9999999999_0_regular";
            await rejectsWith(bookService.book(payload), 400, /exactly one plan/i);
            assert.equal(book.mock.callCount(), 0, "must not book a plan that cannot be persisted");
        } finally {
            book.mock.restore();
        }
    });

    test("accepts the single-plan payload the review flow produces", async () => {
        const book = mock.method(tripJackInsuranceProvider, "book", async () => ({ order: { bookingId: "TJS1" } }));
        try {
            const res: any = await bookService.book(bookPayload());
            assert.equal(res.status, true);
            assert.equal(book.mock.callCount(), 1);
        } finally {
            book.mock.restore();
        }
    });
});

// ─── Traveller / nominee validation (regression, unchanged behaviour) ─────────

describe("traveller validation", () => {
    test("rejects a traveller missing a mandatory field", async () => {
        for (const field of ["dob", "fn", "ln", "eid", "pnum", "gen"]) {
            const t: any = traveller();
            delete t[field];
            const payload = bookPayload();
            payload.pli[0].pi[0].iti = [t];
            await rejectsWith(bookService.book(payload), 400, new RegExp(field));
        }
    });

    test("rejects a traveller without nominee info", async () => {
        const t: any = { ...traveller(), ni: [] };
        const payload = bookPayload();
        payload.pli[0].pi[0].iti = [t];
        await rejectsWith(bookService.book(payload), 400, /nominee/i);
    });

    test("student course is required only when the caller declares a STUDENT journey", async () => {
        const studentPid = "ABHI-PLAN_250_STUDENT-XUSC-AAI_STD";
        const withoutSc = bookPayload({ _journeyType: "STUDENT" });
        withoutSc.pli[0].pi[0].pid = studentPid;
        await rejectsWith(bookService.book(withoutSc), 400, /sc/i);

        // Same payload without the declaration must still be accepted (F-05:
        // classification improved for storage, no new rejections).
        const book = mock.method(tripJackInsuranceProvider, "book", async () => ({ order: { bookingId: "TJS1" } }));
        try {
            const undeclared = bookPayload();
            undeclared.pli[0].pi[0].pid = studentPid;
            const res: any = await bookService.book(undeclared);
            assert.equal(res.status, true);
        } finally {
            book.mock.restore();
        }
    });
});

// ─── F-05 journey classification ──────────────────────────────────────────────

describe("F-05 journey type classification", () => {
    test("an explicit declaration wins", () => {
        assert.equal(explicitJourneyType({ _journeyType: "AMT" }), InsuranceJourneyType.AMT);
        assert.equal(explicitJourneyType({ ict: "API_EMB" }), InsuranceJourneyType.EMBEDDED);
        assert.equal(explicitJourneyType({}), null);
    });

    test("falls back to the plan family in the product id", () => {
        const of = (pid: string) => detectJourneyType({ pli: [{ pi: [{ pid }] }] });
        assert.equal(of("ABHI-PLAN_250_STUDENT-XUSC-AAI_STD"), InsuranceJourneyType.STUDENT);
        assert.equal(of("ABHI-PLAN_250_ANNUAL-WW-AAI"), InsuranceJourneyType.AMT);
        assert.equal(of("ABHI-PLAN_250-WW-AAI-BOXX"), InsuranceJourneyType.STANDALONE);
        assert.equal(detectJourneyType({}), InsuranceJourneyType.STANDALONE);
    });
});

// ─── F-04 ownership scoping ───────────────────────────────────────────────────

describe("F-04 booking reads are scoped to the caller", () => {
    test("listing without a caller identity is refused, not answered with everyone's bookings", async () => {
        await rejectsWith(listService.list({ page: 1, limit: 20 }), 401, /identity/i);
    });

    test("reading a booking by id without a caller identity is refused", async () => {
        await rejectsWith(bookingDetailsService.getFromDb("TJS70850000729798"), 401, /identity/i);
        await rejectsWith(bookingDetailsService.getFromDb("507f1f77bcf86cd799439011"), 401, /identity/i);
    });
});

// ─── B1/B2/B3 review context consistency ──────────────────────────────────────

describe("B1 book must match the reviewed context", () => {
    const ctx = {
        bid: "TJS70010000707761",
        plid: "isid0219009173_0_regular",
        pid: "ABHI-PLAN_250-WW-AAI-BOXX",
        travellerCount: 1,
        travellers: [{ id: 1, age: 30 }],
        reviewedAmount: 1500,
    };

    test("accepts a booking that matches the review", () => {
        assertMatchesReview(bookPayload(), ctx, 1500);
    });

    test("rejects a mismatched plid", () => {
        const p = bookPayload();
        p.pli[0].plid = "isid9999999999_0_regular";
        assert.throws(() => assertMatchesReview(p, ctx, 1500), (e: any) => e.status === 400 && /plan does not match/i.test(e.message));
    });

    test("rejects a mismatched pid", () => {
        const p = bookPayload();
        p.pli[0].pi[0].pid = "ABHI-PLAN_50-ASIA-AAI-BOXX";
        assert.throws(() => assertMatchesReview(p, ctx, 1500), (e: any) => e.status === 400 && /product does not match/i.test(e.message));
    });

    test("rejects fewer travellers than reviewed", () => {
        const four = { ...ctx, travellerCount: 4, travellers: [{ age: 30 }, { age: 31 }, { age: 32 }, { age: 33 }] };
        assert.throws(
            () => assertMatchesReview(bookPayload(), four, 1500),
            (e: any) => e.status === 400 && /reviewed 4, booking 1/i.test(e.message)
        );
    });

    test("rejects more travellers than reviewed", () => {
        const p = bookPayload();
        p.pli[0].pi[0].iti = [traveller(), { ...traveller(), id: 2 }];
        assert.throws(
            () => assertMatchesReview(p, ctx, 1500),
            (e: any) => e.status === 400 && /reviewed 1, booking 2/i.test(e.message)
        );
    });

    test("rejects a traveller age that was not the one priced", () => {
        const p = bookPayload();
        p.pli[0].pi[0].iti = [{ ...traveller(), age: 68 }];
        assert.throws(
            () => assertMatchesReview(p, ctx, 1500),
            (e: any) => e.status === 400 && /ages do not match/i.test(e.message)
        );
    });

    test("age comparison ignores traveller order", () => {
        const two = { ...ctx, travellerCount: 2, travellers: [{ age: 45 }, { age: 30 }] };
        const p = bookPayload();
        p.pli[0].pi[0].iti = [{ ...traveller(), age: 30 }, { ...traveller(), id: 2, age: 45 }];
        assertMatchesReview(p, two, 1500);
    });

    test("rejects a mismatched date of birth when the review captured one", () => {
        const withDob = { ...ctx, travellers: [{ age: 30, dob: "1994-06-15" }] };
        const p = bookPayload();
        p.pli[0].pi[0].iti = [{ ...traveller(), dob: "1960-01-01" }];
        assert.throws(
            () => assertMatchesReview(p, withDob, 1500),
            (e: any) => e.status === 400 && /dates of birth/i.test(e.message)
        );
    });

    test("rejects an amount that is not the reviewed fare", () => {
        assert.throws(
            () => assertMatchesReview(bookPayload(), ctx, 1),
            (e: any) => e.status === 400 && /does not match the reviewed fare/i.test(e.message)
        );
    });

    test("tolerates float noise on the amount", () => {
        assertMatchesReview(bookPayload(), ctx, 1500.004);
    });

    test("skips any field the review never captured", () => {
        // nothing captured → nothing to contradict → booking proceeds
        assertMatchesReview(bookPayload(), { travellerCount: 0, travellers: [], reviewedAmount: null }, 99999);
    });

    test("book proceeds when no review context exists at all (fail-open)", async () => {
        const book = mock.method(tripJackInsuranceProvider, "book", async () => ({ order: { bookingId: "TJS1" } }));
        try {
            const res: any = await bookService.book(bookPayload());
            assert.equal(res.status, true, "an absent context must not block a booking");
        } finally {
            book.mock.restore();
        }
    });
});

describe("B2 reviewed fare extraction", () => {
    test("finds the total fare in the documented shapes", () => {
        assert.equal(extractReviewedAmount({ isr: { iinfo: { pli: [{ pi: [{ tfd: { ifc: { TF: 1610 } } }] }] } } }), 1610);
        assert.equal(extractReviewedAmount({ isr: { iinfo: { pli: [{ pi: [{ ptf: 9050 }] }] } } }), 9050);
    });

    test("returns null rather than guessing when no total is present", () => {
        assert.equal(extractReviewedAmount({ isr: { iinfo: { pli: [{ pi: [{ pid: "P1" }] }] } } }), null);
        assert.equal(extractReviewedAmount({}), null);
        assert.equal(extractReviewedAmount({ isr: { iinfo: { pli: [{ pi: [{ ptf: 0 }] }] } } }), null);
    });
});

// ─── E1/E2/E3 payload integrity ───────────────────────────────────────────────

describe("E1/E2/E3 book payload integrity", () => {
    test("rejects more than one product per plan", async () => {
        const p = bookPayload();
        p.pli[0].pi = [p.pli[0].pi[0], { pid: "ABHI-PLAN_50-ASIA-AAI-BOXX", iti: [traveller()] }];
        await rejectsWith(bookService.book(p), 400, /exactly one product/i);
    });

    test("rejects duplicate traveller ids", async () => {
        const p = bookPayload();
        p.pli[0].pi[0].iti = [traveller(), traveller()]; // both id: 1
        await rejectsWith(bookService.book(p), 400, /duplicate traveller id/i);
    });

    test("accepts travellers with no id at all", async () => {
        const book = mock.method(tripJackInsuranceProvider, "book", async () => ({ order: { bookingId: "TJS1" } }));
        try {
            const p = bookPayload();
            const a: any = traveller(); delete a.id;
            const b: any = { ...traveller(), fn: "Sita" }; delete b.id;
            p.pli[0].pi[0].iti = [a, b];
            const res: any = await bookService.book(p);
            assert.equal(res.status, true, "id is not a documented mandatory field");
        } finally {
            book.mock.restore();
        }
    });

    test("rejects a booking with no delivery email", async () => {
        await rejectsWith(bookService.book(bookPayload({ deliveryInfo: { contacts: ["9810000001"] } })), 400, /deliveryInfo\.emails/i);
        await rejectsWith(bookService.book(bookPayload({ deliveryInfo: { emails: ["  "] } })), 400, /deliveryInfo\.emails/i);
    });

    test("rejects more than one product per plan at review", async () => {
        await rejectsWith(
            reviewService.review({ pli: [{ plid: "isid1", pi: [{ pid: "P1" }, { pid: "P2" }] }] }),
            400,
            /exactly one product/i
        );
    });
});

// ─── B5 dob vs age ────────────────────────────────────────────────────────────

describe("B5 age derived from date of birth", () => {
    test("computes whole years and respects the birthday boundary", () => {
        assert.equal(ageFromDob("1994-06-15", new Date("2024-06-15")), 30);
        assert.equal(ageFromDob("1994-06-15", new Date("2024-06-14")), 29);
        assert.equal(ageFromDob("not-a-date"), null);
    });
});

// ─── D1 reconciliation status mapping ─────────────────────────────────────────

describe("D1 upstream status mapping", () => {
    test("maps terminal statuses and leaves in-flight ones alone", () => {
        assert.equal(mapUpstreamStatus("SUCCESS"), InsuranceBookingStatus.SUCCESS);
        assert.equal(mapUpstreamStatus("FAILED"), InsuranceBookingStatus.FAILED);
        assert.equal(mapUpstreamStatus("ABORTED"), InsuranceBookingStatus.FAILED);
        // the old poller recorded this as FAILED
        assert.equal(mapUpstreamStatus("CANCELLED"), InsuranceBookingStatus.CANCELLED);
        assert.equal(mapUpstreamStatus("PENDING"), null);
        assert.equal(mapUpstreamStatus(""), null);
    });
});

// ─── C4 upstream error messages ───────────────────────────────────────────────

describe("C4 TripJack error messages reach the caller", () => {
    test("the upstream message is carried on the thrown object", async () => {
        // Drive the real normaliseError path with an axios-shaped failure.
        const post = mock.method(tripJackInsuranceClient, "post", async () => {
            throw { response: { status: 400, data: { errors: [{ message: "Invalid productId" }] } } };
        });
        try {
            await tripJackInsuranceProvider.review({ pli: [{ plid: "isid1", pi: [{ pid: "P1" }] }] });
            assert.fail("expected the provider to throw");
        } catch (err: any) {
            assert.equal(err.status, 400);
            assert.equal(err.message, "Invalid productId", "controllers read error.message");
            assert.ok(err.response?.data, "details are still available");
        } finally {
            post.mock.restore();
        }
    });
});

// ─── B4 idempotency: reserve before booking ───────────────────────────────────

describe("B4 booking reservation", () => {
    test("a retry of an in-flight booking is refused without calling TripJack", async () => {
        const create = mock.method(InsuranceBookingModel, "create", async () => {
            throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
        });
        const book = mock.method(tripJackInsuranceProvider, "book", async () => ({ order: { bookingId: "TJS1" } }));
        try {
            await rejectsWith(bookService.book(bookPayload()), 409, /already in progress or complete/i);
            assert.equal(book.mock.callCount(), 0, "the duplicate must never reach TripJack");
        } finally {
            create.mock.restore();
            book.mock.restore();
        }
    });

    test("a rejected booking releases the reservation so a corrected retry can proceed", async () => {
        const create = mock.method(InsuranceBookingModel, "create", async () => ({ _id: "res1" }) as any);
        const del = mock.method(InsuranceBookingModel, "deleteOne", (() => Promise.resolve({}) as any) as any);
        const book = mock.method(tripJackInsuranceProvider, "book", async () => {
            throw { status: 400, message: "Invalid productId", response: { status: 400, data: {} } };
        });
        try {
            await rejectsWith(bookService.book(bookPayload()), 400, /invalid productid/i);
            assert.equal(del.mock.callCount(), 1, "TripJack answered and refused — nothing exists upstream");
        } finally {
            create.mock.restore();
            del.mock.restore();
            book.mock.restore();
        }
    });

    test("an indeterminate upstream failure keeps the reservation", async () => {
        const create = mock.method(InsuranceBookingModel, "create", async () => ({ _id: "res1" }) as any);
        const del = mock.method(InsuranceBookingModel, "deleteOne", (() => Promise.resolve({}) as any) as any);
        const book = mock.method(tripJackInsuranceProvider, "book", async () => {
            throw Object.assign(new Error("timeout of 60000ms exceeded"), { code: "ECONNABORTED" });
        });
        try {
            try {
                await bookService.book(bookPayload());
                assert.fail("expected the timeout to propagate");
            } catch (err: any) {
                assert.match(String(err.message), /timeout/i);
            }
            assert.equal(del.mock.callCount(), 0, "the booking may exist upstream — a retry must stay blocked");
        } finally {
            create.mock.restore();
            del.mock.restore();
            book.mock.restore();
        }
    });
});

// ─── F-03 log redaction ───────────────────────────────────────────────────────

describe("F-03 PII redaction", () => {
    test("masks traveller identity fields but keeps the request shape", () => {
        const out = redactForLog(bookPayload());
        for (const secret of ["1994-06-15", "A1234567", "rahul@example.com", "9810000001", "Priya Sharma", "Rahul"]) {
            assert.ok(!out.includes(secret), `${secret} must not appear in logs`);
        }
        assert.ok(out.includes("TJS70010000707761"), "booking id stays greppable");
        assert.ok(out.includes("isid0219009173_0_regular"), "plan id stays greppable");
        assert.ok(out.includes("ABHI-PLAN_250-WW-AAI-BOXX"), "product id stays greppable");
        assert.ok(out.includes("1500"), "amount stays greppable");
    });

    test("masks the student sponsor block and embedded traveller details", () => {
        const out = redactForLog({
            iid: "isid1",
            pid: "P1",
            iti: [{ fn: "MEENA", ln: "SINGH", eid: "m@example.com", sc: { sn: "John Doe", se: "jd@example.com" } }],
        });
        for (const secret of ["MEENA", "SINGH", "m@example.com", "John Doe", "jd@example.com"]) {
            assert.ok(!out.includes(secret), `${secret} must not appear in logs`);
        }
        assert.ok(out.includes("isid1"));
    });
});
