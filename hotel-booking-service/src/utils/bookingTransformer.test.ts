/**
 * Guardrails for the guest address that reaches the supplier.
 *
 * These exist because the booking form collected a street address, city, state
 * and postal code that never arrived: the commit payload carried no guest
 * address at all, so the transformer fell back to `hotelAddress` (the HOTEL's
 * own street address, sent as if it were the customer's) and to a hardcoded
 * "500001" postal code and "TN" state.
 *
 * RateGain spec 1.5.3, CommitReservation → Guest Details (p.38-39):
 *   CountryCode, PostalCode  Required = Yes (primary guest)
 *   Line1, City, StateCode   Required = No
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import { compileTravellerPayload } from "./bookingTransformer";

const rgContext = { provider: "RateGain", hotelId: "RG:123" };

const baseForm = (overrides: Record<string, any> = {}) => ({
  hotelId: "RG:123",
  hotelAddress: "12 Hotel Street, Panaji",
  city: "Panaji", // the HOTEL's city
  rooms: [
    {
      roomIdx: 0,
      guests: [
        {
          firstName: "ASHA",
          lastName: "RAO",
          isAdult: true,
          email: "asha@example.com",
          mobile: "9876543210",
        },
      ],
    },
  ],
  ...overrides,
});

const firstGuest = (payload: any) =>
  payload.BookReservation.RoomSelection[0].Guest[0];

test("the guest's own postal code is what reaches the supplier", () => {
  const out = compileTravellerPayload(
    baseForm({ guestPostalCode: "560025", guestCountryCode: "IN" }),
    rgContext,
  );

  const g = firstGuest(out);
  assert.equal(g.PostalCode, "560025");
  assert.equal(g.CountryCode, "IN");
});

/** Older clients that still send the optional fields must not be broken. */
test("a legacy client's address fields are still passed through", () => {
  const out = compileTravellerPayload(
    baseForm({
      guestPostalCode: "560025",
      RoomSelection: [
        {
          Guest: [
            { Line1: "4 Residency Road", City: "Bengaluru", StateCode: "KA" },
          ],
        },
      ],
    }),
    rgContext,
  );

  const g = firstGuest(out);
  assert.equal(g.Line1, "4 Residency Road");
  assert.equal(g.City, "Bengaluru");
  assert.equal(g.StateCode, "KA");
});

/** The regression this file exists for. */
test("the hotel's address is never sent as the guest's address", () => {
  const out = compileTravellerPayload(baseForm(), rgContext);
  const g = firstGuest(out);

  assert.notEqual(g.Line1, "12 Hotel Street, Panaji");
  assert.equal("Line1" in g, false);
});

test("blank optional address fields are omitted, not filled with placeholders", () => {
  const out = compileTravellerPayload(
    baseForm({ guestPostalCode: "560025", guestCountryCode: "IN" }),
    rgContext,
  );
  const g = firstGuest(out);

  // Required=No in the RG table => absent rather than "N/A" / "TN".
  assert.equal("Line1" in g, false);
  assert.equal("City" in g, false);
  assert.equal("StateCode" in g, false);
});

test("the hotel's city does not leak into the guest's City", () => {
  const out = compileTravellerPayload(baseForm(), rgContext);
  assert.equal("City" in firstGuest(out), false);
});

test("required fields keep a fallback so a commit is never malformed", () => {
  const g = firstGuest(compileTravellerPayload(baseForm(), rgContext));
  assert.ok(g.CountryCode, "CountryCode is required for the primary guest");
  assert.ok(g.PostalCode, "PostalCode is required for the primary guest");
});

test("TripJack travellers carry no address fields at all", () => {
  const out = compileTravellerPayload(
    baseForm({ hotelId: "TJ:999", guestPostalCode: "560025" }),
    { provider: "TripJack", hotelId: "TJ:999", bookingId: "BK1" },
  );

  const traveller = out.roomTravellerInfo[0].travellerInfo[0];
  for (const field of [
    "Line1",
    "City",
    "StateCode",
    "PostalCode",
    "CountryCode",
  ]) {
    assert.equal(field in traveller, false, `${field} must not be sent to TJ`);
  }
  assert.equal(out.BookReservation, undefined);
});
