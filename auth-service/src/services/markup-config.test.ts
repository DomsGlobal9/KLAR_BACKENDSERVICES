/**
 * Guardrails for region-aware markup resolution.
 *
 * The failure these prevent is silent and expensive: the platform markup is
 * invisible to agents by design, so a rule that resolves to the wrong row — or
 * to nothing — shows up as margin quietly disappearing, with nobody downstream
 * in a position to notice.
 *
 * Two rules do the work:
 *   1. Exact region wins; otherwise the ALL catch-all applies.
 *   2. A configured-but-DISABLED exact rule is a decision, not a miss — it must
 *      NOT fall through to ALL and reinstate a margin the master turned off.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MarkupConfigService,
  canonicalRegion,
  canonicalServiceType,
} from "./markup-config.service";

type Row = {
  scope: string;
  serviceType: string;
  region: string;
  type: "FIXED" | "PERCENTAGE";
  value: number;
  enabled: boolean;
};

/** Stands in for the Mongo-backed repository. */
const serviceWithRows = (rows: Row[]) => {
  const svc = new MarkupConfigService();
  (svc as any).repo = {
    findOne: async (scope: string, serviceType: string, region: string) =>
      rows.find(
        (r) =>
          r.scope === scope &&
          r.serviceType === serviceType &&
          r.region === region,
      ) ?? null,
  };
  return svc;
};

const row = (over: Partial<Row> = {}): Row => ({
  scope: "PLATFORM",
  serviceType: "HOTEL",
  region: "ALL",
  type: "FIXED",
  value: 100,
  enabled: true,
  ...over,
});

// ── serviceType canonicalisation ────────────────────────────────────────────

test("cab spellings all fold to one serviceType", () => {
  assert.equal(canonicalServiceType("CAB"), "CABS");
  assert.equal(canonicalServiceType("CABS"), "CABS");
  assert.equal(canonicalServiceType("cabservices"), "CABS");
  assert.equal(canonicalServiceType("CAB_SERVICES"), "CABS");
});

test("hotel and flight aliases still fold as before", () => {
  assert.equal(canonicalServiceType("HOTELS"), "HOTEL");
  assert.equal(canonicalServiceType("HOTEL"), "HOTEL");
  assert.equal(canonicalServiceType("FLIGHTS"), "FLIGHT");
});

// ── region canonicalisation ─────────────────────────────────────────────────

test("an absent or unknown region means the ALL catch-all", () => {
  assert.equal(canonicalRegion(undefined), "ALL");
  assert.equal(canonicalRegion(""), "ALL");
  assert.equal(canonicalRegion("nonsense"), "ALL");
});

test("region shorthands are accepted", () => {
  assert.equal(canonicalRegion("dom"), "DOMESTIC");
  assert.equal(canonicalRegion("intl"), "INTERNATIONAL");
  assert.equal(canonicalRegion("international"), "INTERNATIONAL");
});

// ── resolution ──────────────────────────────────────────────────────────────

test("an exact-region rule wins over the ALL rule", async () => {
  const svc = serviceWithRows([
    row({ region: "ALL", value: 100 }),
    row({ region: "INTERNATIONAL", value: 250 }),
  ]);

  const intl = await svc.resolve("HOTEL", "INTERNATIONAL");
  assert.equal(intl.platform?.value, 250);
});

test("a region with no rule of its own falls back to ALL", async () => {
  const svc = serviceWithRows([row({ region: "ALL", value: 100 })]);

  const dom = await svc.resolve("HOTEL", "DOMESTIC");
  assert.equal(dom.platform?.value, 100);
});

/** The subtle one: disabled means "no margin here", not "look elsewhere". */
test("a DISABLED exact rule does not fall through to ALL", async () => {
  const svc = serviceWithRows([
    row({ region: "ALL", value: 100, enabled: true }),
    row({ region: "DOMESTIC", value: 0, enabled: false }),
  ]);

  const dom = await svc.resolve("HOTEL", "DOMESTIC");
  assert.equal(dom.platform?.enabled, false);
  assert.notEqual(
    dom.platform?.value,
    100,
    "the ALL margin must not be reinstated",
  );
});

test("never configured stays null so callers can use their env default", async () => {
  const svc = serviceWithRows([]);
  const out = await svc.resolve("HOTEL", "DOMESTIC");

  assert.equal(out.platform, null);
  assert.equal(out.b2c, null);
});

test("a caller that sends no region resolves the ALL rule, as before", async () => {
  const svc = serviceWithRows([
    row({ region: "ALL", value: 100 }),
    row({ region: "DOMESTIC", value: 999 }),
  ]);

  const out = await svc.resolve("HOTEL");
  assert.equal(out.region, "ALL");
  assert.equal(out.platform?.value, 100);
});

test("both scopes resolve independently in one round-trip", async () => {
  const svc = serviceWithRows([
    row({ scope: "PLATFORM", region: "DOMESTIC", value: 100 }),
    row({ scope: "B2C", region: "ALL", value: 50 }),
  ]);

  const out = await svc.resolve("HOTEL", "DOMESTIC");
  assert.equal(out.platform?.value, 100, "exact DOMESTIC rule");
  assert.equal(out.b2c?.value, 50, "falls back to ALL");
});

test("cabs resolve through the same path as hotels", async () => {
  const svc = serviceWithRows([
    row({ serviceType: "CABS", region: "DOMESTIC", value: 75 }),
  ]);

  // Sent as "CAB"; must find the row stored as "CABS".
  const out = await svc.resolve("CAB", "DOMESTIC");
  assert.equal(out.serviceType, "CABS");
  assert.equal(out.platform?.value, 75);
});
