/**
 * Guardrails for the region a commit is priced under.
 *
 * Two properties matter, and both are about money:
 *
 *   1. The client's claimed region NEVER selects the markup. If it did, a
 *      client could claim DOMESTIC on an international stay and pay the
 *      cheaper margin.
 *   2. An unknown country resolves to ALL, never to a guess. A guess would be
 *      wrong half the time and would differ from whatever search decided,
 *      which is precisely the quote-vs-charge divergence this exists to stop.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  extractSupplierCountry,
  resolveBookingRegion,
} from "./bookingRegion.util";

// ── country extraction ──────────────────────────────────────────────────────

test("reads the RateGain hotel country", () => {
  const res = {
    body: { preCheckResponse: { hotel: { countryName: "Italy" } } },
  };
  assert.equal(extractSupplierCountry(res), "Italy");
});

test("reads the TripJack hotel country", () => {
  const res = { body: { hInfo: { ad: { cn: "India" } } } };
  assert.equal(extractSupplierCountry(res), "India");
});

/**
 * The trap. Both payloads carry a guest country too; picking it up would price
 * every Indian customer's overseas stay as domestic.
 */
test("the GUEST's country is never mistaken for the hotel's", () => {
  const res = {
    body: {
      preCheckResponse: {
        hotel: { countryName: "Italy" },
        holder: { country: "IN", countryCode: "IN" },
      },
      guest: { CountryCode: "IN" },
    },
  };
  assert.equal(extractSupplierCountry(res), "Italy");
});

test("a payload with no hotel country yields null", () => {
  assert.equal(
    extractSupplierCountry({ body: { guest: { CountryCode: "IN" } } }),
    null,
  );
  assert.equal(extractSupplierCountry({}), null);
  assert.equal(extractSupplierCountry(null), null);
  assert.equal(extractSupplierCountry("nonsense"), null);
});

test("blank country strings are treated as absent", () => {
  assert.equal(extractSupplierCountry({ hotel: { countryName: "   " } }), null);
});

// ── region resolution ───────────────────────────────────────────────────────

test("a verified domestic stay resolves DOMESTIC", () => {
  const d = resolveBookingRegion({
    precheckResponse: { hotel: { countryName: "India" } },
    claimedRegion: "DOMESTIC",
  });

  assert.equal(d.region, "DOMESTIC");
  assert.equal(d.source, "supplier");
  assert.equal(d.mismatch, false);
});

/** Property 1: the claim cannot buy a cheaper margin. */
test("a client claiming DOMESTIC on an international stay is overruled", () => {
  const d = resolveBookingRegion({
    precheckResponse: { hotel: { countryName: "Italy" } },
    claimedRegion: "DOMESTIC",
  });

  assert.equal(d.region, "INTERNATIONAL", "the supplier's country decides");
  assert.equal(d.mismatch, true, "and the disagreement is surfaced");
});

test("a mismatch is flagged even when the claim is the dearer region", () => {
  const d = resolveBookingRegion({
    precheckResponse: { hotel: { countryName: "India" } },
    claimedRegion: "INTERNATIONAL",
  });

  assert.equal(d.region, "DOMESTIC");
  assert.equal(d.mismatch, true);
});

test("a claim of ALL is not a disagreement", () => {
  // Search had no region-specific rule; commit found one. Not a divergence.
  const d = resolveBookingRegion({
    precheckResponse: { hotel: { countryName: "India" } },
    claimedRegion: "ALL",
  });

  assert.equal(d.region, "DOMESTIC");
  assert.equal(d.mismatch, false);
});

/** Property 2: no guessing. */
test("an unverifiable stay resolves ALL, not a guess", () => {
  const d = resolveBookingRegion({
    precheckResponse: { body: {} },
    claimedRegion: "INTERNATIONAL",
  });

  assert.equal(d.region, "ALL");
  assert.equal(d.source, "none");
  assert.equal(d.unverified, true, "and is counted so coverage is measurable");
  assert.equal(
    d.mismatch,
    false,
    "unverifiable is not the same as contradicted",
  );
});

test("an older client that sends no region still prices safely", () => {
  const d = resolveBookingRegion({
    precheckResponse: { hotel: { countryName: "Italy" } },
  });

  assert.equal(d.region, "INTERNATIONAL");
  assert.equal(d.claimed, null);
  assert.equal(d.mismatch, false);
  assert.equal(d.unverified, false);
});

test("no precheck response at all resolves ALL without throwing", () => {
  const d = resolveBookingRegion({});
  assert.equal(d.region, "ALL");
  assert.equal(d.unverified, false);
});

test("a malformed claimed region is ignored rather than trusted", () => {
  const d = resolveBookingRegion({
    precheckResponse: { hotel: { countryName: "India" } },
    claimedRegion: "'; DROP TABLE",
  });

  assert.equal(d.claimed, null);
  assert.equal(d.region, "DOMESTIC");
});
