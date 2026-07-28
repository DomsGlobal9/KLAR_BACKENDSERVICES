/**
 * Guardrails for the two places this service prices a B2C stay.
 *
 * `/pricing-summary` quotes a total, and commit refuses a payment below
 * `b2cPriceFloor`. Both derive from the master's B2C config, and when they
 * disagree the failure is near-undiagnosable: the customer is quoted one price
 * and charged another, and because the B2C margin is invisible to them the only
 * symptom is a booking that dies at payment validation.
 *
 * That is not hypothetical — the quote path resolved the *agent's* markup rules
 * for B2C callers, got an empty list (there is no agent on that channel), and
 * quoted the api net while commit demanded api net + margin.
 *
 * Run: npm test
 */

// The config snapshot is read from env at module load, and fetchConfig() bails
// out when there is no INTERNAL_SERVICE_KEY. Blanking the key pins these tests
// to the env values below and keeps them off the network. Must happen before
// pricing.util is required, hence require() rather than a hoisted import.
process.env.INTERNAL_SERVICE_KEY = "";
process.env.B2C_MARKUP_ENABLED = "true";
process.env.B2C_MARKUP_TYPE = "FIXED";
process.env.B2C_MARKUP_VALUE = "100";
process.env.PLATFORM_MARKUP_ENABLED = "false";

import test from "node:test";
import assert from "node:assert/strict";

type PricingUtilModule = typeof import("./pricing.util");
type WalletUtilModule = typeof import("./wallet.util");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { b2cPriceFloor, b2cMarkupAmount, PricingUtil } =
  require("./pricing.util") as PricingUtilModule;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveMarkupRules } = require("./wallet.util") as WalletUtilModule;

/** The api net (supplier net + platform markup) for the Deluxe Room rate. */
const API_NET = 2008.81;

/** Reloads the pricing modules under a different master config. */
const reloadWith = (env: Record<string, string>) => {
  Object.assign(process.env, env);
  for (const id of [
    "./pricing.util",
    "../config/markup-config",
    "./wallet.util",
  ]) {
    delete require.cache[require.resolve(id)];
  }
  return {
    pricing: require("./pricing.util") as PricingUtilModule,
    wallet: require("./wallet.util") as WalletUtilModule,
  };
};

test("the B2C floor is api net + the master's margin", () => {
  assert.equal(b2cMarkupAmount(API_NET), 100);
  assert.equal(b2cPriceFloor(API_NET), 2108.81);
});

test("the quote a B2C customer is given equals the floor commit will demand", async () => {
  const rules = await resolveMarkupRules(
    "B2C",
    "irrelevant-no-agent-lookup-on-b2c",
  );
  const quoted = PricingUtil.calculatePriceWithMarkup(API_NET, rules, 0);

  assert.equal(
    quoted.total,
    b2cPriceFloor(API_NET),
    "quote drifted from the floor",
  );
  assert.equal(quoted.total, 2108.81);
  assert.equal(quoted.markup, 100);
});

test("a signed-out GUEST is priced as B2C, not as a third channel", async () => {
  const guest = await resolveMarkupRules("GUEST", "token");
  const b2c = await resolveMarkupRules("B2C", "token");

  assert.deepEqual(guest, b2c);
  assert.equal(
    PricingUtil.calculatePriceWithMarkup(API_NET, guest, 0).total,
    b2cPriceFloor(API_NET),
  );
});

test("the master's B2C rule is resolved from config, not from the caller's token", async () => {
  const rules = await resolveMarkupRules("B2C", "any-token-at-all");

  assert.deepEqual(rules, [
    { serviceType: "HOTEL", percentageMarkup: 0, fixedMarkup: 100 },
  ]);
});

test("quote and floor still agree when the master switches to a percentage", async () => {
  const { pricing, wallet } = reloadWith({
    B2C_MARKUP_TYPE: "PERCENTAGE",
    B2C_MARKUP_VALUE: "10",
  });

  const rules = await wallet.resolveMarkupRules("B2C", "token");
  const quoted = pricing.PricingUtil.calculatePriceWithMarkup(
    API_NET,
    rules,
    0,
  );

  assert.equal(pricing.b2cPriceFloor(API_NET), 2209.69); // 2008.81 + 10%
  assert.equal(quoted.total, pricing.b2cPriceFloor(API_NET));
});

test("a disabled B2C config sells at the api net on both sides", async () => {
  const { pricing, wallet } = reloadWith({
    B2C_MARKUP_ENABLED: "false",
    B2C_MARKUP_TYPE: "FIXED",
    B2C_MARKUP_VALUE: "100",
  });

  const rules = await wallet.resolveMarkupRules("B2C", "token");
  const quoted = pricing.PricingUtil.calculatePriceWithMarkup(
    API_NET,
    rules,
    0,
  );

  // "Configured off" is a decision and must yield zero — unlike a failed config
  // fetch, which falls back rather than silently selling at cost.
  assert.deepEqual(rules, []);
  assert.equal(pricing.b2cPriceFloor(API_NET), API_NET);
  assert.equal(quoted.total, API_NET);
});
