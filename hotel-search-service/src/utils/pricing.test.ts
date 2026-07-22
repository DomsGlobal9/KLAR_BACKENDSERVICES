/**
 * Guardrails for the client-facing price contract.
 *
 * These exist because the master's B2C markup was configured, applied, and then
 * silently lost before it reached the customer: the response carried four
 * different totals, only some of which included the margin, and each screen
 * picked a different one. The invariant below is what makes that impossible to
 * reintroduce — if `basePrice + taxesAndFees === totalPrice` holds, there is no
 * "other" total for a screen to pick.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublicPricing,
  calculateEnrichedPricing,
  MarkupRule,
  PricingInput,
} from "./pricing.util";

const HOTEL_RULE_FIXED_100: MarkupRule = {
  serviceType: "HOTEL",
  percentageMarkup: 0,
  fixedMarkup: 100,
};

/** The real Fabhotel S Continental "Deluxe Room / Room Only" rate. */
const TJ_PRODUCT_RATE: PricingInput = {
  basePrice: 1985.21,
  totalPrice: 2008.81,
  taxes: 0,
  mf: 20,
  mft: 3.6,
  currency: "INR",
};

/** Search-list shape: `taxes` is known, but mf/mft have no field to arrive in. */
const TJ_LIST_RATE: PricingInput = {
  basePrice: 1884.58,
  totalPrice: 2008.81,
  taxes: 100.63,
  mf: 0,
  mft: 0,
  currency: "INR",
};

/** RateGain shape: taxes on top, no management fees. */
const RG_RATE: PricingInput = {
  basePrice: 4000,
  totalPrice: 4720,
  taxes: 720,
  mf: 0,
  mft: 0,
  currency: "INR",
};

const priceIt = (
  input: PricingInput,
  rules: MarkupRule[],
  clientType: "B2B" | "B2C",
  nights = 1,
) =>
  buildPublicPricing({
    enriched: calculateEnrichedPricing(input, rules, nights),
    taxes: input.taxes,
    mf: input.mf,
    mft: input.mft,
    currency: input.currency,
    clientType,
  });

// ---------------------------------------------------------------------------
// The invariant
// ---------------------------------------------------------------------------

test("basePrice + taxesAndFees === totalPrice, on every shape and channel", () => {
  const shapes: Array<[string, PricingInput]> = [
    ["TJ product rate", TJ_PRODUCT_RATE],
    // The regression case: summing the named taxes/mf/mft here (rather than
    // deriving total-base) leaves the breakdown ₹23.60 short of the total,
    // because the list payload has nowhere to put the management fees.
    ["TJ search-list rate", TJ_LIST_RATE],
    ["RG rate", RG_RATE],
  ];
  const rulesets: Array<[string, MarkupRule[]]> = [
    ["fixed markup", [HOTEL_RULE_FIXED_100]],
    ["percentage markup", [{ serviceType: "HOTEL", percentageMarkup: 12.5, fixedMarkup: 0 }]],
    ["no rule", []],
  ];

  for (const [shapeName, shape] of shapes) {
    for (const [rulesName, rules] of rulesets) {
      for (const clientType of ["B2C", "B2B"] as const) {
        const p = priceIt(shape, rules, clientType);
        assert.equal(
          Math.round((p.basePrice + p.taxesAndFees) * 100) / 100,
          p.totalPrice,
          `${shapeName} / ${rulesName} / ${clientType}: breakdown does not add up to the total`,
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Channel shaping
// ---------------------------------------------------------------------------

test("B2C folds the master's margin into basePrice and sells at the marked-up total", () => {
  const p = priceIt(TJ_PRODUCT_RATE, [HOTEL_RULE_FIXED_100], "B2C");

  assert.equal(p.markupAmount, 100);
  assert.equal(p.basePrice, 2085.21, "margin must be inside the base the customer sees");
  assert.equal(p.taxesAndFees, 23.6);
  assert.equal(p.totalPrice, 2108.81, "B2C is charged the marked-up total");
  assert.equal(p.finalTotalPrice, 2108.81);
});

test("B2B keeps the agent's own margin visible rather than folded away", () => {
  const p = priceIt(TJ_PRODUCT_RATE, [HOTEL_RULE_FIXED_100], "B2B");

  assert.equal(p.basePrice, 1985.21, "agents see the api net, not a padded base");
  assert.equal(p.totalPrice, 2008.81, "totalPrice is the api total for agents");
  assert.equal(p.markupAmount, 100, "the agent's margin stays a separate, editable line");
  assert.equal(p.finalTotalPrice, 2108.81);
});

test("a disabled/absent rule sells at cost on both channels", () => {
  for (const clientType of ["B2C", "B2B"] as const) {
    const p = priceIt(TJ_PRODUCT_RATE, [], clientType);
    assert.equal(p.markupAmount, 0);
    assert.equal(p.basePrice, 1985.21);
    assert.equal(p.totalPrice, 2008.81);
  }
});

test("a percentage markup rides on the gross and still reconciles", () => {
  const p = priceIt(TJ_PRODUCT_RATE, [
    { serviceType: "HOTEL", percentageMarkup: 10, fixedMarkup: 0 },
  ], "B2C");

  assert.equal(p.markupAmount, 200.88); // 10% of 2008.81
  assert.equal(p.totalPrice, 2209.69);
  assert.equal(Math.round((p.basePrice + p.taxesAndFees) * 100) / 100, p.totalPrice);
});

// ---------------------------------------------------------------------------
// Cross-service contract
// ---------------------------------------------------------------------------

test("B2C sell price === api net + margin, the formula commit's b2cPriceFloor enforces", () => {
  // hotel-booking-service rejects a payment below b2cPriceFloor(apiNet), which
  // is apiNet + the same B2C margin. If this service ever quotes anything else,
  // every B2C booking fails price validation at commit with no clue why.
  for (const shape of [TJ_PRODUCT_RATE, TJ_LIST_RATE, RG_RATE]) {
    const p = priceIt(shape, [HOTEL_RULE_FIXED_100], "B2C");
    assert.equal(
      p.totalPrice,
      Math.round((p.supplierTotalPrice + p.markupAmount) * 100) / 100,
      "quoted total drifted from the floor commit will demand",
    );
  }
});

test("per-night price is derived from the marked-up total, not the supplier's", () => {
  const nights = 3;
  const p = priceIt(TJ_PRODUCT_RATE, [HOTEL_RULE_FIXED_100], "B2C", nights);

  // Rounding a per-night figure to paise means n x perNight cannot always land
  // exactly on the total (2108.81 / 3 -> 702.94 -> 2108.82), so the property
  // worth holding is that it is derived from the right total: off by at most a
  // paisa per night, rather than by the whole ₹100 margin.
  assert.ok(
    Math.abs(p.perNightPrice * nights - p.totalPrice) <= 0.01 * nights,
    `per-night x nights (${p.perNightPrice * nights}) is not the total ${p.totalPrice}`,
  );
});
