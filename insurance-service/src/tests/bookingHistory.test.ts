/**
 * B2C insurance booking-history lookup by email.
 *
 * Uses the Node built-in test runner, matching the existing suite. Mongoose is
 * mocked at the model boundary so nothing here touches a database.
 */
import { test, mock, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    bookingHistoryService,
    normalizeEmail,
    isValidEmail,
    emailFilter,
    QUALIFYING_HISTORY_STATUSES,
} from "../services/bookingHistory.service";
import { InsuranceBookingModel, InsuranceBookingStatus } from "../models/InsuranceBooking.model";

mongoose.set("bufferCommands", false);

/** Asserts the promise rejects with the given HTTP status. */
async function rejectsWith(p: Promise<unknown>, status: number, match?: RegExp) {
    try {
        await p;
    } catch (err: any) {
        assert.equal(err.status, status, `expected ${status}, got ${err.status}: ${err.message}`);
        if (match) assert.match(String(err.message), match);
        return;
    }
    assert.fail(`expected rejection with status ${status}, but it resolved`);
}

/** Stub countDocuments, capturing the filter it was called with. */
function mockCount(result: number) {
    const calls: any[] = [];
    const m = mock.method(InsuranceBookingModel, "countDocuments", (filter: any) => {
        calls.push(filter);
        return { limit: () => Promise.resolve(result), then: (r: any) => r(result) } as any;
    });
    return { m, calls };
}

// ─── Email normalisation and validation ───────────────────────────────────────

describe("email handling", () => {
    test("normalises case and surrounding whitespace", () => {
        assert.equal(normalizeEmail("  Customer@Example.COM  "), "customer@example.com");
        assert.equal(normalizeEmail("customer@example.com"), "customer@example.com");
    });

    test("normalises absent input to an empty string rather than throwing", () => {
        assert.equal(normalizeEmail(undefined), "");
        assert.equal(normalizeEmail(null), "");
    });

    test("accepts well-formed addresses and rejects malformed ones", () => {
        assert.ok(isValidEmail("customer@example.com"));
        assert.ok(!isValidEmail("customer"));
        assert.ok(!isValidEmail("customer@"));
        assert.ok(!isValidEmail("customer@example"));
        assert.ok(!isValidEmail("cust omer@example.com"));
    });
});

// ─── Qualifying statuses ──────────────────────────────────────────────────────

describe("qualifying booking statuses", () => {
    test("FAILED never counts as a booking", () => {
        assert.ok(!QUALIFYING_HISTORY_STATUSES.includes(InsuranceBookingStatus.FAILED));
    });

    test("SUCCESS, CANCELLED and PENDING all count", () => {
        for (const status of [
            InsuranceBookingStatus.SUCCESS,
            InsuranceBookingStatus.CANCELLED,
            InsuranceBookingStatus.PENDING,
        ]) {
            assert.ok(QUALIFYING_HISTORY_STATUSES.includes(status), `${status} must qualify`);
        }
    });

    test("the filter constrains status and searches every email location", () => {
        const filter: any = emailFilter("customer@example.com");
        assert.deepEqual(filter.status, { $in: QUALIFYING_HISTORY_STATUSES });

        const paths = filter.$or.map((clause: any) => Object.keys(clause)[0]);
        assert.deepEqual(paths, ["contactEmail", "travellers.eid", "tjBookPayload.deliveryInfo.emails"]);

        // the indexed path compares by equality, not by regex
        assert.equal(filter.$or[0].contactEmail, "customer@example.com");
    });

    test("agentName is deliberately not searched", () => {
        // For a B2C guest agentName holds "B2C Guest", not an address, so
        // searching it would both miss real bookings and match unrelated ones.
        const filter: any = emailFilter("customer@example.com");
        const paths = filter.$or.map((clause: any) => Object.keys(clause)[0]);
        assert.ok(!paths.includes("agentName"));
    });

    test("regex metacharacters in an email are escaped, not interpreted", () => {
        const filter: any = emailFilter("a+b.c@example.com");
        const pattern: RegExp = filter.$or[1]["travellers.eid"];
        assert.ok(pattern.test("a+b.c@example.com"), "the literal address must match");
        assert.ok(!pattern.test("aXbXc@example.com"), "'.' must not act as a wildcard");
    });
});

// ─── Existence check ──────────────────────────────────────────────────────────

describe("hasBookings", () => {
    test("rejects a missing email", async () => {
        await rejectsWith(bookingHistoryService.hasBookings(""), 400, /required/i);
    });

    test("rejects a malformed email", async () => {
        await rejectsWith(bookingHistoryService.hasBookings("not-an-email"), 400, /invalid/i);
    });

    test("returns true when a qualifying booking exists", async () => {
        const { m } = mockCount(1);
        try {
            assert.equal(await bookingHistoryService.hasBookings("customer@example.com"), true);
        } finally {
            m.mock.restore();
        }
    });

    test("returns false when none exists", async () => {
        const { m } = mockCount(0);
        try {
            assert.equal(await bookingHistoryService.hasBookings("nobody@example.com"), false);
        } finally {
            m.mock.restore();
        }
    });

    test("an uppercase or padded email finds the same bookings", async () => {
        const { m, calls } = mockCount(1);
        try {
            await bookingHistoryService.hasBookings("  Customer@Example.COM ");
            assert.equal(calls[0].$or[0].contactEmail, "customer@example.com");
        } finally {
            m.mock.restore();
        }
    });

    test("only qualifying statuses are counted", async () => {
        const { m, calls } = mockCount(0);
        try {
            await bookingHistoryService.hasBookings("customer@example.com");
            assert.deepEqual(calls[0].status, { $in: QUALIFYING_HISTORY_STATUSES });
        } finally {
            m.mock.restore();
        }
    });

    test("a database failure surfaces rather than reporting 'no bookings'", async () => {
        const m = mock.method(InsuranceBookingModel, "countDocuments", () => {
            throw new Error("connection lost");
        });
        try {
            await assert.rejects(
                () => bookingHistoryService.hasBookings("customer@example.com"),
                /connection lost/
            );
        } finally {
            m.mock.restore();
        }
    });
});

// ─── History listing ──────────────────────────────────────────────────────────

describe("listByEmail", () => {
    const booking = (over: Record<string, any> = {}) => ({
        bookingId: "TJS70010000707761",
        status: InsuranceBookingStatus.SUCCESS,
        journeyType: "STANDALONE",
        planId: "isid0219009173_0_regular",
        productId: "ABHI-PLAN_250-WW-AAI-BOXX",
        amount: 1500,
        currencyCode: "INR",
        createdAt: new Date("2026-06-01"),
        travellers: [
            {
                fn: "Rahul",
                ln: "Sharma",
                dob: "1994-06-15",
                age: 30,
                gen: "M",
                pnum: "A1234567",
                cnum: "9810000001",
                eid: "customer@example.com",
                policyId: "TSON11038682",
                ni: [{ nn: "Priya Sharma", nr: "SPOUSE" }],
            },
        ],
        tjBookPayload: { deliveryInfo: { emails: ["customer@example.com"] } },
        ...over,
    });

    function mockFind(docs: any[]) {
        const find = mock.method(InsuranceBookingModel, "find", () => ({
            sort: () => ({
                skip: () => ({
                    limit: () => ({ lean: () => Promise.resolve(docs) }),
                }),
            }),
        }) as any);
        const count = mock.method(
            InsuranceBookingModel,
            "countDocuments",
            () => Promise.resolve(docs.length) as any
        );
        return { restore: () => { find.mock.restore(); count.mock.restore(); } };
    }

    test("rejects an unverified or malformed email", async () => {
        await rejectsWith(bookingHistoryService.listByEmail(""), 400, /valid verified email/i);
        await rejectsWith(bookingHistoryService.listByEmail("nope"), 400, /valid verified email/i);
    });

    test("returns a summary, not the raw booking", async () => {
        const h = mockFind([booking()]);
        try {
            const res: any = await bookingHistoryService.listByEmail("customer@example.com");
            const item = res.body.bookings[0];

            assert.equal(item.bookingId, "TJS70010000707761");
            assert.equal(item.status, "SUCCESS");
            assert.equal(item.amount, 1500);
            assert.equal(item.travellerCount, 1);
            assert.deepEqual(item.policyIds, ["TSON11038682"]);
        } finally {
            h.restore();
        }
    });

    test("passport, nominee and raw payloads never reach the response", async () => {
        const h = mockFind([booking()]);
        try {
            const res: any = await bookingHistoryService.listByEmail("customer@example.com");
            const serialized = JSON.stringify(res);

            // The customer proved control of this email, so their own
            // travellers' names and dates of birth are shown in the details
            // modal. Passport, nominee and the raw upstream payload are not
            // rendered anywhere and stay in the service.
            for (const secret of [
                "A1234567",      // passport number
                "Priya Sharma",  // nominee name
                "SPOUSE",        // nominee relation
                "tjBookPayload",
                "deliveryInfo",
            ]) {
                assert.ok(!serialized.includes(secret), `${secret} must not be returned`);
            }
        } finally {
            h.restore();
        }
    });

    test("returns the insured people the details modal renders", async () => {
        const h = mockFind([booking()]);
        try {
            const res: any = await bookingHistoryService.listByEmail("customer@example.com");
            const item = res.body.bookings[0];

            // "0 Person(s)" and "N/A" in the modal came from these being absent.
            assert.equal(item.travellers.length, 1);
            assert.equal(item.travellerCount, 1);

            const traveller = item.travellers[0];
            assert.equal(traveller.fn, "Rahul");
            assert.equal(traveller.ln, "Sharma");
            assert.equal(traveller.dob, "1994-06-15");
            assert.equal(traveller.eid, "customer@example.com");
            assert.equal(traveller.cnum, "9810000001");
            assert.equal(traveller.policyId, "TSON11038682");

            // the modal reads booking.createdAt
            assert.ok(item.createdAt, "createdAt must be present");

            // passport must not ride along on the traveller
            assert.equal((traveller as any).pnum, undefined);
            assert.equal((traveller as any).ni, undefined);
        } finally {
            h.restore();
        }
    });

    test("multiple bookings are all returned", async () => {
        const h = mockFind([
            booking(),
            booking({ bookingId: "TJS70010000707762", status: InsuranceBookingStatus.CANCELLED }),
        ]);
        try {
            const res: any = await bookingHistoryService.listByEmail("customer@example.com");
            assert.equal(res.body.bookings.length, 2);
            assert.equal(res.body.pagination.total, 2);
        } finally {
            h.restore();
        }
    });

    test("an email with no bookings yields an empty list, not an error", async () => {
        const h = mockFind([]);
        try {
            const res: any = await bookingHistoryService.listByEmail("nobody@example.com");
            assert.deepEqual(res.body.bookings, []);
            assert.equal(res.body.pagination.total, 0);
        } finally {
            h.restore();
        }
    });

    test("the page size is clamped so a caller cannot request everything", async () => {
        const h = mockFind([]);
        try {
            const res: any = await bookingHistoryService.listByEmail("customer@example.com", 1, 10_000);
            assert.equal(res.body.pagination.limit, 100);

            const negative: any = await bookingHistoryService.listByEmail("customer@example.com", -5, -5);
            assert.equal(negative.body.pagination.page, 1);
            assert.equal(negative.body.pagination.limit, 1);
        } finally {
            h.restore();
        }
    });
});
