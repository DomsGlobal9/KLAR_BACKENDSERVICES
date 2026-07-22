/**
 * Guardrails for picking an agent's markup rule when several regions exist.
 *
 * An agent can hold one rule per (serviceType, region). Before regions there
 * was at most one rule per serviceType, so callers could take the first match.
 * Now "first match" is whatever order Mongo returned the array in — which is
 * how an agent's DOMESTIC margin could silently be charged on an international
 * stay, or vice versa.
 *
 * Precedence must match auth-service's MarkupConfigService.resolve exactly:
 * an exact-region rule wins, otherwise the ALL catch-all applies.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import { pickRulesForRegion } from "./auth";
import { MarkupRule } from "./pricing.util";

const rule = (over: Partial<MarkupRule> = {}): MarkupRule => ({
  serviceType: "HOTEL",
  percentageMarkup: 0,
  fixedMarkup: 100,
  ...over,
});

test("an exact-region rule beats the ALL catch-all", () => {
  const out = pickRulesForRegion(
    [
      rule({ region: "ALL", fixedMarkup: 100 }),
      rule({ region: "INTERNATIONAL", fixedMarkup: 250 }),
    ],
    "INTERNATIONAL",
  );

  assert.equal(out.length, 1);
  assert.equal(out[0].fixedMarkup, 250);
});

/** Array order must not decide which margin an agent is paid. */
test("the exact-region rule wins regardless of array order", () => {
  const out = pickRulesForRegion(
    [
      rule({ region: "INTERNATIONAL", fixedMarkup: 250 }),
      rule({ region: "ALL", fixedMarkup: 100 }),
    ],
    "INTERNATIONAL",
  );

  assert.equal(out[0].fixedMarkup, 250);
});

test("a region with no rule of its own falls back to ALL", () => {
  const out = pickRulesForRegion([rule({ region: "ALL", fixedMarkup: 100 })], "DOMESTIC");

  assert.equal(out.length, 1);
  assert.equal(out[0].fixedMarkup, 100);
});

/** The cross-contamination case. */
test("another region's rule is never applied", () => {
  const out = pickRulesForRegion(
    [rule({ region: "INTERNATIONAL", fixedMarkup: 250 })],
    "DOMESTIC",
  );

  assert.deepEqual(out, [], "an international-only rule must not price a domestic stay");
});

test("a rule with no region is treated as ALL", () => {
  // Pre-region rows, before the migration stamps them.
  const out = pickRulesForRegion([rule({ fixedMarkup: 100 })], "DOMESTIC");
  assert.equal(out[0].fixedMarkup, 100);
});

test("different serviceTypes resolve independently", () => {
  const out = pickRulesForRegion(
    [
      rule({ serviceType: "HOTEL", region: "DOMESTIC", fixedMarkup: 100 }),
      rule({ serviceType: "CABS", region: "ALL", fixedMarkup: 50 }),
    ],
    "DOMESTIC",
  );

  const byType = Object.fromEntries(out.map((r) => [r.serviceType, r.fixedMarkup]));
  assert.deepEqual(byType, { HOTEL: 100, CABS: 50 });
});

test("one rule per serviceType is returned, never duplicates", () => {
  const out = pickRulesForRegion(
    [
      rule({ region: "ALL", fixedMarkup: 100 }),
      rule({ region: "DOMESTIC", fixedMarkup: 200 }),
    ],
    "DOMESTIC",
  );

  assert.equal(out.length, 1, "a duplicate would double-charge the margin");
  assert.equal(out[0].fixedMarkup, 200);
});

test("an empty or missing rule set is safe", () => {
  assert.deepEqual(pickRulesForRegion([], "DOMESTIC"), []);
  assert.deepEqual(pickRulesForRegion(undefined as any, "DOMESTIC"), []);
});
