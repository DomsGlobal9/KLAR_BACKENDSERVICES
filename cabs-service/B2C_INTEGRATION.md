# Cabs Service — B2C / Guest Integration Contract

How a **B2C** (logged-in customer) or **GUEST** (anonymous) frontend integrates
with `cabs-service`. B2B (agent) uses the same endpoints but pays via the Klar
wallet with a JWT — see the note at the end.

- **Base URL**: `VITE_BACKEND_CABS_URL` (default `http://localhost:5016`)
- **Payments**: B2C/GUEST pay through **Razorpay**, verified server-side. B2B pays via the agent Klar wallet.
- **Channel selection**: the backend infers the channel from the JWT + the `x-client-type` header:
  - Valid agent JWT + `x-client-type: B2B` → **B2B** (wallet).
  - Valid customer JWT (or `x-client-type: B2C`) → **B2C** (Razorpay).
  - No token → **GUEST** (Razorpay). A `B2C` claim with no token is treated as GUEST.

---

## End-to-end B2C / GUEST flow

```
1. POST /search/location      → pick pickup + drop (Google Places)
2. POST /search/lat-long      → resolve placeId → { lat, lng, address }
3. POST /search/quotes        → list vehicle groups + quotes (fares)
4. POST {payment-service}/api/pay/razorpay/create-order   → Razorpay order
5. Razorpay Checkout (browser)                            → razorpayPaymentId
6. POST /booking/create       → { …quote, razorpayOrderId, razorpayPaymentId }
                                 backend VERIFIES the payment, then books
7. GET  /booking/details?bookingIds=TJS…   → poll final status
   (cancel: GET /amendment/charges → POST /amendment/cancel)
```

The customer must pay **before** step 6. The backend verifies the Razorpay
payment server-side and rejects the booking if it isn't captured or doesn't
cover the amount — the browser is never trusted to say "paid".

---

## 1–3. Search (no auth)

| Step | Method | Path | Body |
|---|---|---|---|
| Location | POST | `/search/location` | `{ "input": "igi" }` |
| Lat/Long | POST | `/search/lat-long` | `{ "placeId": "ChIJ…" }` |
| Quotes | POST | `/search/quotes` | see below |

**`/search/quotes` request**
```json
{
  "pickupDate": "2026-08-01 09:00",
  "returnDate": "2026-08-05 18:00",
  "origin": { "type": "location", "displayAddress": "IGI T3, Delhi",
    "lat": "28.5550838", "long": "77.0844015",
    "address": { "city": "Delhi", "country": "India", "postalCode": "110037" } },
  "destination": { "type": "location", "displayAddress": "CP, New Delhi",
    "lat": "28.6304203", "long": "77.2177216",
    "address": { "city": "New Delhi", "country": "India", "postalCode": "110001" } },
  "journeyType": "airport_transfer",
  "tripType": "oneway",
  "passengers": 2
}
```
`journeyType`: `airport_transfer | outstation | local | rental`.
`tripType`: `oneway | roundtrip` (send `returnDate` for roundtrip).
`pickupDate` must be ≥ 2h in the future; `returnDate` ≥ 30m after pickup.

Each quote in `data.quotesInfo[].quotes[]` carries `quotationId`,
`quoteChildId`, `vendorId`, and `fareBreakup.{totalFare,totalTax}` — keep them
for the booking. **Do not trust the browser's price**: the backend re-fetches a
live quote at book time and rejects a fare that rose beyond tolerance
(`PRICE_CHANGED`).

---

## 4. Create Razorpay order (payment-service)

`POST {PAYMENT_SERVICE}/api/pay/razorpay/create-order`

Amount = the gross the customer sees = `totalFare + totalTax + anyMarkup`. The
backend requires the captured payment to cover **at least** the fresh supplier
net, so pass the true gross. Use the returned `razorpayOrderId` in Checkout and
in step 6.

---

## 6. Create booking — `POST /booking/create`

**Headers** (B2C/GUEST): `Content-Type: application/json`. No `Authorization`
for guests; a customer JWT may be sent. Optionally `x-client-type: B2C`.

**Body** (note the two Razorpay fields — required for B2C/GUEST):
```json
{
  "journeyInfo": {
    "journeyType": "AIRPORT_TRANSFER",
    "tripType": "ONEWAY",
    "pickupDateTime": "2026-08-01T09:00:00",
    "distance": "19 Km",
    "duration": 38
  },
  "routeDetail": {
    "isDomestic": true,
    "origin": { "type": "location", "displayAddress": "IGI T3, Delhi",
      "lat": "28.5550838", "long": "77.0844015",
      "address": { "city": "Delhi", "country": "India" } },
    "destination": { "type": "location", "displayAddress": "CP, New Delhi",
      "lat": "28.6304203", "long": "77.2177216",
      "address": { "city": "New Delhi", "country": "India" } }
  },
  "quotationInfo": {
    "vehicleType": "Sedan",
    "vehicleCategory": "Standard",
    "quoteId": "<quotationId from /search/quotes>",
    "childQuoteId": "<quoteChildId>",
    "paxCount": 2,
    "luggageCount": 2,
    "vendorId": 1
  },
  "pricingInfo": {
    "netAmount": "1463.00",
    "tjTaxAmount": "33.00",
    "addonsPrice": "0.00",
    "agentMarkup": 0,
    "agentMarkupSplitup": { "onwardJourneyMarkup": 0, "returnJourneyMarkup": 0 },
    "grossAmount": "1496.00"
  },
  "passengerDetail": {
    "firstName": "Jack", "lastName": "Jerry",
    "email": "jack@example.com", "phone": "+919890809809"
  },
  "consent": "yes",

  "razorpayOrderId": "order_XXXXXXXX",
  "razorpayPaymentId": "pay_XXXXXXXX"
}
```

`grossAmount` is what the customer is charged (Klar side). The backend pays the
supplier separately. `quoteId`/`childQuoteId` may be refreshed server-side to a
non-expired quote automatically.

**Success (200)** — the raw TripJack booking envelope; read:
```jsonc
{ "success": true, "data": {
    "id": "TJS8084864058222",       // bookingId
    "status": "CONFIRMED",          // or SUPPLIER_PENDING / FAILED
    "paymentStatus": "SUCCESS"
} }
```
- `CONFIRMED` → booked, voucher email sent.
- `SUPPLIER_PENDING` → still settling; poll `/booking/details`. The 2-min
  reconciliation worker resolves it and **auto-refunds** to Razorpay if it fails.
- `FAILED` → already auto-refunded to Razorpay; show the refund message.

**Failure** → JSON `{ "success": false, "code": "...", "message": "..." }` with
the HTTP status from the table below. On any failure a captured payment is
refunded automatically.

---

## 7. Booking details / cancel

- `GET /booking/details?bookingIds=TJS…` — live status (comma-separate ids).
- `GET /booking/my-bookings?userId=<id>` — a customer's bookings (needs JWT).
- `GET /amendment/charges?bookingId=TJS…&type=CANCELLATION` — refund quote.
- `POST /amendment/cancel` `{ "bookingId": "TJS…", "amendmentType": "CANCELLATION" }`
  — cancels at the supplier and **refunds the customer on Razorpay**. The refund
  is the **API (supplier) price minus the cancellation charges** only; the Klar
  **markup and the cancellation penalty are retained** (not returned).

---

## Error codes (`code` field) → HTTP status

| code | HTTP | Meaning / UX |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing/invalid field (e.g. no `razorpayPaymentId`). |
| `PAYMENT_UNVERIFIED` | 402 | Razorpay payment not captured / too low. Auto-refunded. |
| `PRICE_CHANGED` | 409 | Fare rose beyond tolerance since search. Re-quote. |
| `VEHICLE_CHANGED` | 409 | Supplier remapped the vehicle. Re-select. |
| `VEHICLE_SOLD_OUT` | 409 | No longer available. Search again. |
| `DUPLICATE_REQUEST` | 409 | Same booking already in flight. |
| `CIRCUIT_BREAKER_OPEN` / `SUPPLIER_ERROR` | 502/503 | Supplier down. Retry later. |
| `INSUFFICIENT_BALANCE` | 402 | (B2B only) agent wallet too low. |

---

## B2B (agent) note

Same endpoints, but send the agent JWT (`Authorization: Bearer …`) and
`x-client-type: B2B`. The backend debits the **agent Klar wallet** instead of
verifying Razorpay, and refunds the wallet on failure. Do **not** debit the
wallet from the frontend — the backend owns it (prevents double-charge).

## Required backend env
`INTERNAL_SERVICE_KEY` and `PAYMENT_SERVICE_URL` must be set, or B2C payment
verification fails closed (bookings rejected) and gateway refunds cannot run.
Set `REDIS_URL` to enable the distributed booking lock (otherwise the
idempotency unique-index is the sole duplicate guard).
