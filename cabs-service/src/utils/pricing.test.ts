/**
 * Guardrails for cab pricing.
 *
 * THE BUG THESE LOCK OUT
 * ----------------------
 * Cabs had no markup system. The customer-facing gross came from the request
 * body and the margin was `pricingInfo.agentMarkup` — also from the request
 * body. The only price guard, in ValidationEngine, blocks a supplier price
 * INCREASE beyond tolerance and says nothing about a gross that is too LOW, so
 * a caller could send grossAmount === the bare supplier net and pay us nothing.
 *
 * The invariant below is what makes that impossible to reintroduce: the gross
 * is a pure function of the supplier's fresh fare and the configured rules, and
 * no input from the caller appears in it.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetMarkupConfigForTests,
  __setMarkupConfigForTests,
} from "../config/markup-config";
import { calculateCabPrice, agentMarkupAmount } from "./pricing.util";
import { MarkupRule } from "./wallet.util";

/** Seeds a region's config without a network call. */
const seed = (
  region: "ALL" | "DOMESTIC" | "INTERNATIONAL",
  platform: Partial<{ type: "FIXED" | "PERCENTAGE"; value: number; enabled: boolean }>,
  b2c: Partial<{ type: "FIXED" | "PERCENTAGE"; value: number; enabled: boolean }> = {},
) => {
  __setMarkupConfigForTests(region, {
    platform: { type: "FIXED", value: 0, enabled: false, ...platform },
    b2c: { type: "FIXED", value: 0, enabled: false, ...b2c },
  });
};

const rule = (over: Partial<MarkupRule> = {}): MarkupRule => ({
  serviceType: "CABS",
  percentageMarkup: 0,
  fixedMarkup: 0,
  ...over,
});

// ── agent margin ────────────────────────────────────────────────────────────

test("an agent's fixed margin is added to the api net", () => {
  assert.equal(agentMarkupAmount(1000, [rule({ fixedMarkup: 150 })]), 150);
});

test("an agent's percentage margin rides on the api net", () => {
  assert.equal(agentMarkupAmount(1000, [rule({ percentageMarkup: 10 })]), 100);
});

test("a rule for another service never prices a cab", () => {
  const rules = [rule({ serviceType: "HOTEL", fixedMarkup: 999 })];
  assert.equal(agentMarkupAmount(1000, rules), 0);
});

test("no rules means no agent margin, not a crash", () => {
  assert.equal(agentMarkupAmount(1000, []), 0);
  assert.equal(agentMarkupAmount(1000, undefined as any), 0);
});

test("a zero or negative net yields no margin", () => {
  assert.equal(agentMarkupAmount(0, [rule({ fixedMarkup: 150 })]), 0);
  assert.equal(agentMarkupAmount(-50, [rule({ fixedMarkup: 150 })]), 0);
});

// ── end-to-end price ────────────────────────────────────────────────────────

test("with no configured markup the customer pays the supplier net", () => {
  __resetMarkupConfigForTests();

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
  });

  assert.equal(p.supplierNet, 1000);
  assert.equal(p.gross, 1000);
  assert.equal(p.markupAmount, 0);
});

test("a B2B agent's margin stacks on top of the api net", () => {
  __resetMarkupConfigForTests();

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2B",
    agentRules: [rule({ fixedMarkup: 200 })],
  });

  assert.equal(p.apiNet, 1000, "no platform markup configured in this test");
  assert.equal(p.channelMarkup, 200);
  assert.equal(p.gross, 1200);
  assert.equal(p.markupAmount, 200);
});

/**
 * The channel-isolation rule: a B2C caller has no agent, and their own token
 * must never contribute markup rules. Passing agent rules on a B2C request must
 * change nothing.
 */
test("agent rules are ignored on the B2C channel", () => {
  __resetMarkupConfigForTests();

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [rule({ fixedMarkup: 500 })],
  });

  assert.equal(p.channelMarkup, 0);
  assert.equal(p.gross, 1000);
});

test("a signed-out GUEST is priced as B2C, not as a third channel", () => {
  __resetMarkupConfigForTests();

  const guest = calculateCabPrice({
    supplierNet: 1000,
    clientType: "GUEST",
    agentRules: [rule({ fixedMarkup: 500 })],
  });
  const b2c = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [rule({ fixedMarkup: 500 })],
  });

  assert.deepEqual(guest, b2c);
});

/** The invariant that closes the hole. */
test("the gross never depends on anything the caller sent", () => {
  __resetMarkupConfigForTests();

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2B",
    agentRules: [rule({ fixedMarkup: 200 })],
  });

  // Same inputs, same answer — there is no parameter through which a client
  // could lower this.
  const again = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2B",
    agentRules: [rule({ fixedMarkup: 200 })],
  });

  assert.deepEqual(p, again);
  assert.equal(p.gross, p.supplierNet + p.platformMarkup + p.channelMarkup);
});

test("markupAmount always reconciles gross back to the supplier net", () => {
  __resetMarkupConfigForTests();

  for (const net of [0, 1, 999.99, 12345.67]) {
    const p = calculateCabPrice({
      supplierNet: net,
      clientType: "B2B",
      agentRules: [rule({ percentageMarkup: 7.5 })],
    });
    assert.equal(
      p.markupAmount,
      Math.round((p.gross - p.supplierNet) * 100) / 100,
      `net=${net}`,
    );
    assert.ok(p.gross >= p.supplierNet, `gross must never undercut net (net=${net})`);
  }
});

test("a negative or junk supplier net is clamped rather than trusted", () => {
  __resetMarkupConfigForTests();

  const p = calculateCabPrice({
    supplierNet: -500,
    clientType: "B2B",
    agentRules: [rule({ fixedMarkup: 200 })],
  });

  assert.equal(p.supplierNet, 0);
  assert.ok(p.gross >= 0);
});

test("the region is carried through to the breakdown", () => {
  __resetMarkupConfigForTests();

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
    region: "INTERNATIONAL",
  });

  assert.equal(p.region, "INTERNATIONAL");
});

// ── region-specific markup ──────────────────────────────────────────────────

test("the platform margin is folded into the api net before the agent's", () => {
  __resetMarkupConfigForTests();
  seed("ALL", { value: 100, enabled: true });

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2B",
    agentRules: [rule({ fixedMarkup: 200 })],
  });

  // Worked example from the markup model: the agent perceives 1100 as "the api
  // price" and cannot decompose our 100 out of it.
  assert.equal(p.platformMarkup, 100);
  assert.equal(p.apiNet, 1100);
  assert.equal(p.channelMarkup, 200);
  assert.equal(p.gross, 1300);
});

test("an international journey is priced with the international rule", () => {
  __resetMarkupConfigForTests();
  seed("DOMESTIC", { value: 50, enabled: true });
  seed("INTERNATIONAL", { value: 400, enabled: true });

  const dom = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
    region: "DOMESTIC",
  });
  const intl = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
    region: "INTERNATIONAL",
  });

  assert.equal(dom.gross, 1050);
  assert.equal(intl.gross, 1400);
});

test("an unfetched region falls back to ALL, never to zero margin", () => {
  __resetMarkupConfigForTests();
  seed("ALL", { value: 100, enabled: true });

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
    region: "INTERNATIONAL",
  });

  assert.equal(p.platformMarkup, 100, "selling at supplier net would be a silent loss");
});

test("the master's B2C rule prices the B2C channel", () => {
  __resetMarkupConfigForTests();
  seed("ALL", { value: 100, enabled: true }, { value: 250, enabled: true });

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
  });

  assert.equal(p.apiNet, 1100);
  assert.equal(p.channelMarkup, 250);
  assert.equal(p.gross, 1350);
});

test("a percentage platform rule rides on the supplier net", () => {
  __resetMarkupConfigForTests();
  seed("ALL", { type: "PERCENTAGE", value: 10, enabled: true });

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
  });

  assert.equal(p.platformMarkup, 100);
  assert.equal(p.gross, 1100);
});

test("a disabled rule sells at cost rather than applying its value", () => {
  __resetMarkupConfigForTests();
  seed("ALL", { value: 500, enabled: false });

  const p = calculateCabPrice({
    supplierNet: 1000,
    clientType: "B2C",
    agentRules: [],
  });

  assert.equal(p.gross, 1000);
});
