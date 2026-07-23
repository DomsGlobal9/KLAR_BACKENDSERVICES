/**
 * Guardrails for supplier image resolution.
 *
 * These exist because a hotel detail page advertised "19 Photos" and rendered
 * nineteen broken tiles. The frontend inferred the CDN from the file extension,
 * so every relative TripJack path was rewritten to the Hotelbeds CDN, which had
 * never hosted it. The invariant below is what stops that returning: a
 * reference we cannot resolve yields "" and is dropped, never guessed into a
 * URL that will 404.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import { qualifyImageUrl, qualifyImageUrls } from "./imageUrl.util";

test("absolute URLs pass through untouched for either supplier", () => {
  const url = "https://cdn.example.com/a/b/photo.jpg";
  assert.equal(qualifyImageUrl(url, "TJ"), url);
  assert.equal(qualifyImageUrl(url, "RG"), url);
});

test("protocol-relative URLs are forced to https", () => {
  assert.equal(
    qualifyImageUrl("//cdn.example.com/photo.jpg", "RG"),
    "https://cdn.example.com/photo.jpg",
  );
});

test("RateGain relative filenames resolve to the Hotelbeds CDN", () => {
  assert.equal(
    qualifyImageUrl("014216a_hb_f_003.jpg", "RG"),
    "https://photos.hotelbeds.com/giata/014216a_hb_f_003.jpg",
  );
});

test("a _hb_ path is Hotelbeds whichever supplier reported it", () => {
  assert.equal(
    qualifyImageUrl("014216a_hb_f_003.jpg", "TJ"),
    "https://photos.hotelbeds.com/giata/014216a_hb_f_003.jpg",
  );
});

/** The regression this whole module exists for. */
test("TripJack relative paths are dropped, not aimed at the Hotelbeds CDN", () => {
  assert.equal(qualifyImageUrl("some/tj/photo.jpg", "TJ"), "");
  assert.equal(qualifyImageUrl("photo.png", "TJ"), "");
});

test("supplier hotel ids in an image array are not treated as images", () => {
  assert.equal(qualifyImageUrl("TJ:12345", "TJ"), "");
  assert.equal(qualifyImageUrl("RG:12345", "RG"), "");
  assert.equal(qualifyImageUrl("998877", "TJ"), "");
});

test("nested link objects are unwrapped, preferring the largest variant", () => {
  const entry = {
    links: {
      L: { href: "https://cdn.example.com/L.jpg" },
      "1000px": { href: "https://cdn.example.com/1000.jpg" },
    },
  };
  assert.equal(qualifyImageUrl(entry, "TJ"), "https://cdn.example.com/1000.jpg");
});

test("empty and malformed entries resolve to the empty string", () => {
  assert.equal(qualifyImageUrl(null, "TJ"), "");
  assert.equal(qualifyImageUrl(undefined, "RG"), "");
  assert.equal(qualifyImageUrl("   ", "RG"), "");
  assert.equal(qualifyImageUrl({}, "TJ"), "");
});

test("qualifyImageUrls drops unresolvable entries rather than counting them", () => {
  const out = qualifyImageUrls(
    [
      "https://cdn.example.com/good.jpg",
      "unresolvable/relative.jpg", // TJ + relative => dropped
      "TJ:999",
      "",
      null,
    ],
    "TJ",
  );
  assert.deepEqual(out, ["https://cdn.example.com/good.jpg"]);
});

/** A duplicate inflates the photo count exactly the way a dead URL did. */
test("qualifyImageUrls de-duplicates repeated assets", () => {
  const out = qualifyImageUrls(
    [
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
    ],
    "RG",
  );
  assert.deepEqual(out, [
    "https://cdn.example.com/a.jpg",
    "https://cdn.example.com/b.jpg",
  ]);
});

test("a single non-array entry is accepted", () => {
  assert.deepEqual(qualifyImageUrls("https://cdn.example.com/x.jpg", "TJ"), [
    "https://cdn.example.com/x.jpg",
  ]);
  assert.deepEqual(qualifyImageUrls(null, "TJ"), []);
});
