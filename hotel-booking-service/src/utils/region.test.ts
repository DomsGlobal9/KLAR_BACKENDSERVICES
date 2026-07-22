/**
 * Shared region-derivation vectors.
 *
 * ─── THIS FILE IS DUPLICATED ────────────────────────────────────────────────
 * An identical copy lives at hotel-booking-service/src/utils/region.test.ts.
 * The two services derive the region independently — search to price a stay,
 * commit to validate that price — so they must agree on every input. Pinning
 * the SAME vectors in both is what makes a one-sided edit fail CI instead of
 * quoting a customer one price and charging another.
 *
 * If you change a vector here, change it in the other copy in the same commit.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import { deriveRegion, deriveRegionFrom } from "./region.util";

test("the home market is DOMESTIC, by code or by name", () => {
  assert.equal(deriveRegion("IN"), "DOMESTIC");
  assert.equal(deriveRegion("in"), "DOMESTIC");
  assert.equal(deriveRegion(" In "), "DOMESTIC");
  assert.equal(deriveRegion("India"), "DOMESTIC");
  assert.equal(deriveRegion("INDIA"), "DOMESTIC");
});

test("other countries are INTERNATIONAL, by code or by name", () => {
  assert.equal(deriveRegion("AE"), "INTERNATIONAL");
  assert.equal(deriveRegion("US"), "INTERNATIONAL");
  assert.equal(deriveRegion("United Arab Emirates"), "INTERNATIONAL");
  assert.equal(deriveRegion("Thailand"), "INTERNATIONAL");
});

/**
 * The important one. An unknown country must NOT be guessed: guessing
 * INTERNATIONAL overcharges, guessing DOMESTIC undercharges, and either guess
 * risks differing from the other service's guess. ALL is the catch-all both
 * sides agree on.
 */
test("an unknown country is ALL, never a guess", () => {
  assert.equal(deriveRegion(undefined), "ALL");
  assert.equal(deriveRegion(null), "ALL");
  assert.equal(deriveRegion(""), "ALL");
  assert.equal(deriveRegion("   "), "ALL");
});

test("deriveRegionFrom takes the first usable signal", () => {
  assert.equal(deriveRegionFrom(undefined, "", "IN"), "DOMESTIC");
  assert.equal(deriveRegionFrom("", null, "AE"), "INTERNATIONAL");
});

test("a blank first candidate does not mask a good later one", () => {
  // The bug this guards: returning ALL for the first empty candidate and
  // never reaching the country we actually know.
  assert.equal(deriveRegionFrom("", "India"), "DOMESTIC");
});

test("all-unknown candidates stay ALL", () => {
  assert.equal(deriveRegionFrom(undefined, "", null), "ALL");
  assert.equal(deriveRegionFrom(), "ALL");
});

test("the first candidate wins when several are usable", () => {
  // Callers pass most-authoritative first; a later signal must not override it.
  assert.equal(deriveRegionFrom("AE", "IN"), "INTERNATIONAL");
});
