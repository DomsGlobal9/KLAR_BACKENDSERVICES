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
import { reviewService } from "../services/review.service";
import { bookService, detectJourneyType, explicitJourneyType } from "../services/book.service";
import { listService } from "../services/list.service";
import { bookingDetailsService } from "../services/bookingDetails.service";
import { tripJackInsuranceProvider, redactForLog } from "../providers/tripjack.insurance.provider";
import { InsuranceJourneyType } from "../models/InsuranceBooking.model";

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
