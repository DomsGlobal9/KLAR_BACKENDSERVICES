/**
 * Insurance booking confirmation email.
 *
 * Node built-in test runner, matching the existing suites. axios and the
 * Mongoose model are mocked, so no email is ever sent and no database is
 * touched.
 */
import { test, mock, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import axios from "axios";

import {
    bookingNotificationService,
    resolveRecipients,
    MAX_NOTIFICATION_ATTEMPTS,
} from "../services/bookingNotification.service";
import {
    InsuranceBookingModel,
    InsuranceBookingStatus,
    InsuranceNotificationStatus,
} from "../models/InsuranceBooking.model";
import { env } from "../config/env";
import {
    renderInsuranceBookingConfirmation,
    insuranceBookingConfirmationSubject,
} from "../templates/insuranceBookingConfirmation.template";

mongoose.set("bufferCommands", false);

// The service no-ops without this, so give it a value for every test.
env.EMAIL_SERVICE = "http://email-service.test/api/email";

const b2bBooking = (over: Record<string, any> = {}) => ({
    bookingId: "TJS70010000707761",
    status: InsuranceBookingStatus.SUCCESS,
    // A real authenticated agent id — not a guest sentinel.
    agentId: "61025303",
    agentName: "agent@agency.com",
    contactEmail: "traveller@example.com",
    productId: "ABHI-PLAN_250-ASIA-AAI-BOXX",
    currencyCode: "INR",
    amount: 1900,
    travellers: [{ fn: "Rahul", ln: "Sharma", eid: "traveller@example.com", policyId: "TSON110386" }],
    ...over,
});

const b2cBooking = (over: Record<string, any> = {}) =>
    b2bBooking({ agentId: "b2c_guest_user", agentName: "B2C Guest", ...over });

/** Capture what the service posts to email-service. */
function mockAxios(behaviour: "ok" | "fail" = "ok") {
    const calls: any[] = [];
    const m = mock.method(axios, "post", async (url: string, body: any) => {
        calls.push({ url, body });
        if (behaviour === "fail") throw new Error("email-service unavailable");
        return { data: { success: true } };
    });
    return { m, calls };
}

/** Stub the claim + the follow-up writes. Returns the updates performed. */
function mockModel(claimResult: any) {
    const updates: any[] = [];
    const claim = mock.method(InsuranceBookingModel, "findOneAndUpdate", (filter: any, update: any) => {
        updates.push({ kind: "claim", filter, update });
        return { lean: () => Promise.resolve(claimResult) } as any;
    });
    const write = mock.method(InsuranceBookingModel, "updateOne", (filter: any, update: any) => {
        updates.push({ kind: "write", filter, update });
        return Promise.resolve({}) as any;
    });
    return { updates, restore: () => { claim.mock.restore(); write.mock.restore(); } };
}

/** The status the service settled on, from the recorded writes. */
function settledStatus(updates: any[]): string | undefined {
    const write = [...updates].reverse().find((u) => u.kind === "write");
    return write?.update?.$set?.["confirmationEmail.status"];
}

// ─── Recipient rules ──────────────────────────────────────────────────────────

describe("recipient selection", () => {
    test("B2B sends to the traveller and the B2B client", () => {
        const { source, recipients } = resolveRecipients(b2bBooking());
        assert.equal(source, "B2B");
        assert.deepEqual(
            recipients.map((r) => [r.type, r.email]).sort(),
            [["B2B_CLIENT", "agent@agency.com"], ["TRAVELLER", "traveller@example.com"]].sort()
        );
    });

    test("B2C sends to the traveller only", () => {
        const { source, recipients } = resolveRecipients(b2cBooking());
        assert.equal(source, "B2C");
        assert.equal(recipients.length, 1);
        assert.equal(recipients[0]!.type, "TRAVELLER");
    });

    test("a guest OTP identity is treated as B2C", () => {
        // auth-service mints userId `guest-<email>` for a verified guest.
        const { source } = resolveRecipients(b2bBooking({ agentId: "guest-someone@example.com" }));
        assert.equal(source, "B2C");
    });

    test("an identical agent and traveller address is sent once", () => {
        const { recipients } = resolveRecipients(
            b2bBooking({ agentName: "same@example.com", contactEmail: "same@example.com" })
        );
        assert.equal(recipients.length, 1);
        assert.equal(recipients[0]!.email, "same@example.com");
    });

    test("deduplication ignores case and padding", () => {
        const { recipients } = resolveRecipients(
            b2bBooking({ agentName: "  SAME@Example.com ", contactEmail: "same@example.com" })
        );
        assert.equal(recipients.length, 1);
    });

    test("B2B with no client email still reaches the traveller", () => {
        const { recipients, warnings } = resolveRecipients(b2bBooking({ agentName: "B2C Guest" }));
        assert.deepEqual(recipients.map((r) => r.type), ["TRAVELLER"]);
        assert.ok(warnings.some((w) => /B2B client email/i.test(w)));
    });

    test("B2B with no traveller email still reaches the client", () => {
        const { recipients, warnings } = resolveRecipients(
            b2bBooking({ contactEmail: undefined, travellers: [], tjBookPayload: undefined })
        );
        assert.deepEqual(recipients.map((r) => r.type), ["B2B_CLIENT"]);
        assert.ok(warnings.some((w) => /traveller email/i.test(w)));
    });

    test("no usable address yields no recipients rather than an invented one", () => {
        const { recipients } = resolveRecipients(
            b2cBooking({ contactEmail: undefined, travellers: [], tjBookPayload: undefined })
        );
        assert.deepEqual(recipients, []);
    });

    test("a non-email agentName is never used as a recipient", () => {
        // agentName falls back to a display name, which must not be emailed.
        const { recipients } = resolveRecipients(b2bBooking({ agentName: "Acme Travel Pvt Ltd" }));
        assert.ok(!recipients.some((r) => r.type === "B2B_CLIENT"));
    });

    test("legacy bookings resolve the traveller from deliveryInfo", () => {
        const { recipients } = resolveRecipients(
            b2cBooking({
                contactEmail: undefined,
                travellers: [],
                tjBookPayload: { deliveryInfo: { emails: ["legacy@example.com"] } },
            })
        );
        assert.equal(recipients[0]!.email, "legacy@example.com");
    });
});

// ─── Sending ──────────────────────────────────────────────────────────────────

describe("sending the confirmation", () => {
    let http: ReturnType<typeof mockAxios>;
    let model: ReturnType<typeof mockModel>;

    beforeEach(() => {
        mock.restoreAll();
    });

    test("a B2B booking emails both parties and records SENT", async () => {
        http = mockAxios();
        model = mockModel(b2bBooking());
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.equal(http.calls.length, 2);
            assert.equal(settledStatus(model.updates), InsuranceNotificationStatus.SENT);
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });

    test("a B2C booking emails only the traveller", async () => {
        http = mockAxios();
        model = mockModel(b2cBooking());
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.equal(http.calls.length, 1);
            assert.equal(http.calls[0].body.to, "traveller@example.com");
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });

    test("it posts to email-service's generic send endpoint", async () => {
        http = mockAxios();
        model = mockModel(b2cBooking());
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.match(http.calls[0].url, /\/send$/);
            assert.ok(http.calls[0].body.subject.includes("TJS70010000707761"));
            assert.ok(http.calls[0].body.html.includes("TJS70010000707761"));
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });

    test("a booking that is not SUCCESS is never claimed, so nothing is sent", async () => {
        http = mockAxios();
        // The claim filter requires status SUCCESS; a PENDING/FAILED booking
        // matches nothing, which the model mock represents as null.
        model = mockModel(null);
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.equal(http.calls.length, 0);
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });

    test("the claim filter demands SUCCESS and excludes already-sent bookings", async () => {
        http = mockAxios();
        model = mockModel(null);
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            const claim = model.updates.find((u) => u.kind === "claim");

            assert.equal(claim.filter.status, InsuranceBookingStatus.SUCCESS);
            const excluded = claim.filter["confirmationEmail.status"].$nin;
            assert.ok(excluded.includes(InsuranceNotificationStatus.SENT));
            assert.ok(excluded.includes(InsuranceNotificationStatus.SENDING));
            // and the attempt counter advances as part of the same atomic write
            assert.equal(claim.update.$inc["confirmationEmail.attempts"], 1);
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });

    test("a second call finds the booking already claimed and sends nothing", async () => {
        http = mockAxios();
        // Mongo returns null for the loser of the atomic update.
        model = mockModel(null);
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.equal(http.calls.length, 0, "duplicate processing must not re-send");
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });

    test("no recipient is terminal, and no email is attempted", async () => {
        http = mockAxios();
        model = mockModel(b2cBooking({ contactEmail: undefined, travellers: [], tjBookPayload: undefined }));
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.equal(http.calls.length, 0);
            assert.equal(
                settledStatus(model.updates),
                InsuranceNotificationStatus.SKIPPED_NO_RECIPIENT
            );
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });
});

// ─── Reliability ──────────────────────────────────────────────────────────────

describe("email failure never affects the booking", () => {
    test("an email-service outage is recorded as FAILED and does not throw", async () => {
        const http = mockAxios("fail");
        const model = mockModel(b2cBooking());
        try {
            // The reconciliation sweep awaits this; if it threw, the sweep would
            // treat a settled booking as a failure.
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.equal(settledStatus(model.updates), InsuranceNotificationStatus.FAILED);
        } finally {
            model.restore();
            http.m.mock.restore();
        }
    });

    test("a missing EMAIL_SERVICE URL is a no-op, not a crash", async () => {
        const original = env.EMAIL_SERVICE;
        env.EMAIL_SERVICE = "";
        const http = mockAxios();
        const model = mockModel(b2cBooking());
        try {
            await bookingNotificationService.sendBookingConfirmation("TJS70010000707761");
            assert.equal(http.calls.length, 0);
        } finally {
            env.EMAIL_SERVICE = original;
            model.restore();
            http.m.mock.restore();
        }
    });

    test("retries are bounded", () => {
        assert.ok(MAX_NOTIFICATION_ATTEMPTS >= 1 && MAX_NOTIFICATION_ATTEMPTS <= 10);
    });

    test("the retry sweep only picks up failed, under-limit confirmations", async () => {
        const captured: any[] = [];
        const find = mock.method(InsuranceBookingModel, "find", (filter: any) => {
            captured.push(filter);
            return {
                select: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }),
            } as any;
        });
        try {
            await bookingNotificationService.retryFailedConfirmations();
            assert.equal(captured[0].status, InsuranceBookingStatus.SUCCESS);
            assert.equal(
                captured[0]["confirmationEmail.status"],
                InsuranceNotificationStatus.FAILED
            );
            assert.deepEqual(captured[0]["confirmationEmail.attempts"], {
                $lt: MAX_NOTIFICATION_ATTEMPTS,
            });
        } finally {
            find.mock.restore();
        }
    });
});

// ─── Template ─────────────────────────────────────────────────────────────────

describe("confirmation template", () => {
    const data = {
        bookingId: "TJS70010000707761",
        policyId: "TSON110386",
        planName: "Platinum ($250,000 Cover)",
        planTier: "Platinum",
        coverageAmount: "$250,000",
        provider: "ABHI",
        coverageRegion: "Asia",
        coverageStart: "16 Aug 2026",
        coverageEnd: "04 Sep 2026",
        destination: "Austria",
        amount: "₹1,900",
        supplierPrice: "₹1,500",
        sellingPrice: "₹1,900",
        markup: "₹0",
        gst: "₹288",
        agentEarnings: "₹400",
        agencyName: "ABC Travels",
        agentName: "John Doe",
        agentId: "AGT123",
        travellers: [{ name: "Rahul Sharma", email: "rahul@gmail.com", policyId: "TSON110386" }],
        recipientType: "TRAVELLER" as const,
    };

    test("renders Traveller Layout correctly", () => {
        const html = renderInsuranceBookingConfirmation(data);
        assert.ok(html.includes("Hello Rahul Sharma"));
        assert.ok(html.includes("TJS70010000707761"));
        assert.ok(html.includes("TSON110386"));
        assert.ok(html.includes("Austria"));
        assert.ok(html.includes("Key Benefits"));
    });

    test("renders Agent Layout correctly for B2B Client", () => {
        const html = renderInsuranceBookingConfirmation({ ...data, recipientType: "B2B_CLIENT" });
        assert.ok(html.includes("B2B AGENT COPY"));
        assert.ok(html.includes("ABC Travels"));
        assert.ok(html.includes("John Doe"));
        assert.ok(html.includes("AGT123"));
        assert.ok(html.includes("FINANCIAL SUMMARY"));
        assert.ok(html.includes("Agent Earnings"));
    });

    test("the agency copy subject is distinguishable from the traveller copy", () => {
        const agency = insuranceBookingConfirmationSubject("TJS1", "B2B_CLIENT");
        const traveller = insuranceBookingConfirmationSubject("TJS1", "TRAVELLER");
        assert.ok(agency.includes("Agency Copy"));
        assert.ok(!traveller.includes("Agency Copy"));
    });

    test("traveller names are escaped rather than injected", () => {
        const html = renderInsuranceBookingConfirmation({
            ...data,
            travellers: [{ name: "<script>alert(1)</script>", policyId: undefined }],
        });
        assert.ok(!html.includes("<script>"), "markup in a name must not reach the email");
        assert.ok(html.includes("&lt;script&gt;"));
    });
});

