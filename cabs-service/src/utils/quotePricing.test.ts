/**
 * Guardrails for the quote-vs-charge contract on cabs.
 *
 * booking.service computes the customer-facing gross server-side. If search
 * returned the bare supplier fare, every booking would be quoted at net and
 * charged at net + markup — the price would jump at the last step. The tests
 * below pin the invariant that closes that: what search shows for a quote is
 * exactly what booking will charge for the same supplier fare.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetMarkupConfigForTests,
  __setMarkupConfigForTests,
} from "../config/markup-config";
import { applyMarkupToQuotes } from "./quotePricing.util";
import { calculateCabPrice } from "./pricing.util";
import { MarkupRule } from "./wallet.util";

const seed = (platformValue: number, b2cValue = 0) => {
  __resetMarkupConfigForTests();
  __setMarkupConfigForTests("ALL", {
    platform: { type: "FIXED", value: platformValue, enabled: platformValue > 0 },
    b2c: { type: "FIXED", value: b2cValue, enabled: b2cValue > 0 },
  });
};

const quoteResponse = (totalFare: number, totalTax: number) => ({
  data: {
    quotesInfo: [
      {
        vehicleType: "SEDAN",
        quotes: [{ quotationId: "q1", fareBreakup: { totalFare, totalTax } }],
      },
    ],
  },
});

const fareOf = (res: any) => res.data.quotesInfo[0].quotes[0].fareBreakup;
const klarOf = (res: any) => res.data.quotesInfo[0].quotes[0].klarPricing;

const agentRule = (fixed: number): MarkupRule => ({
  serviceType: "CABS",
  percentageMarkup: 0,
  fixedMarkup: fixed,
});

/** The invariant this file exists for. */
test("what search quotes equals what booking will charge", () => {
  seed(100);

  const supplierFare = 1000;
  const supplierTax = 50;
  const res = quoteResponse(supplierFare, supplierTax);

  applyMarkupToQuotes(res, {
    clientType: "B2B",
    agentRules: [agentRule(200)],
    region: "ALL",
  });

  // What booking will independently compute from the same supplier net.
  const charged = calculateCabPrice({
    supplierNet: supplierFare + supplierTax,
    clientType: "B2B",
    agentRules: [agentRule(200)],
    region: "ALL",
  });

  const quotedGross = fareOf(res).totalFare + fareOf(res).totalTax;
  assert.equal(quotedGross, charged.gross);
});

test("the margin rides on fare + tax, matching the precheck's freshTotal", () => {
  seed(100);

  const res = quoteResponse(1000, 50);
  applyMarkupToQuotes(res, { clientType: "B2C", agentRules: [], region: "ALL" });

  // supplierNet = 1050, +100 platform => gross 1150; tax is left untouched so
  // totalFare carries the margin.
  assert.equal(klarOf(res).supplierNet, 1050);
  assert.equal(klarOf(res).gross, 1150);
  assert.equal(fareOf(res).totalTax, 50, "supplier tax is reported as-is");
  assert.equal(fareOf(res).totalFare, 1100);
});

test("the full breakdown is attached for clients that want it", () => {
  seed(100, 250);

  const res = quoteResponse(1000, 0);
  applyMarkupToQuotes(res, { clientType: "B2C", agentRules: [], region: "ALL" });

  const k = klarOf(res);
  assert.equal(k.platformMarkup, 100);
  assert.equal(k.apiNet, 1100);
  assert.equal(k.channelMarkup, 250);
  assert.equal(k.gross, 1350);
});

test("every quote in every vehicle group is priced", () => {
  seed(100);

  const res: any = {
    data: {
      quotesInfo: [
        { quotes: [{ fareBreakup: { totalFare: 1000, totalTax: 0 } }] },
        {
          quotes: [
            { fareBreakup: { totalFare: 2000, totalTax: 0 } },
            { fareBreakup: { totalFare: 3000, totalTax: 0 } },
          ],
        },
      ],
    },
  };

  const summary = applyMarkupToQuotes(res, {
    clientType: "B2C",
    agentRules: [],
    region: "ALL",
  });

  assert.equal(summary.quotesPriced, 3);
  assert.equal(res.data.quotesInfo[0].quotes[0].fareBreakup.totalFare, 1100);
  assert.equal(res.data.quotesInfo[1].quotes[1].fareBreakup.totalFare, 3100);
});

/** An unpriceable quote is reported, not silently marked up or dropped. */
test("a quote with no usable fare is left alone and counted", () => {
  seed(100);

  const res: any = {
    data: {
      quotesInfo: [
        {
          quotes: [
            { fareBreakup: { totalFare: 0, totalTax: 0 } },
            { fareBreakup: null },
            {},
          ],
        },
      ],
    },
  };

  const summary = applyMarkupToQuotes(res, {
    clientType: "B2C",
    agentRules: [],
    region: "ALL",
  });

  assert.equal(summary.quotesPriced, 0);
  assert.equal(summary.quotesSkipped, 3);
  assert.equal(res.data.quotesInfo[0].quotes[0].fareBreakup.totalFare, 0);
});

test("a malformed or empty response does not throw", () => {
  seed(100);

  for (const res of [{}, { data: {} }, { data: { quotesInfo: null } }, null]) {
    const summary = applyMarkupToQuotes(res, {
      clientType: "B2C",
      agentRules: [],
      region: "ALL",
    });
    assert.equal(summary.quotesPriced, 0);
  }
});

test("agent rules do not leak into a B2C quote", () => {
  seed(0);

  const res = quoteResponse(1000, 0);
  applyMarkupToQuotes(res, {
    clientType: "B2C",
    agentRules: [agentRule(500)],
    region: "ALL",
  });

  assert.equal(fareOf(res).totalFare, 1000, "no agent exists on the B2C channel");
});
