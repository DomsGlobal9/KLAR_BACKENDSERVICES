# 🚕 Cabs & Hotels — Functional Bug Audit (B2B + B2C)

**Scope:** `cabs-service` (full money path), `hotel-booking-service` (delta since the fix commit), and the cab/hotel booking flows in `KLAR_B2B_FRONTEND` + `KLAR_B2C_FRONTEND_NEW`.
**Date:** 2026-07-15
**Method:** Code trace of search → precheck → pay → commit → settle → cancel → refund, plus route/authz review. No live bookings run (production supplier + Razorpay creds).

---

## 0a. Remediation status (2026-07-15)

**Fixed in this change set:** CAB-C1, CAB-H1, CAB-H2, CAB-H3, CAB-H4, CAB-M1, CAB-M2 (Klar-loss part), CAB-M3, CAB-F1, CAB-F2, CAB-F3.
- New `cabs-service/src/utils/ownership.util.ts` (token / admin / guest-capability ownership check).
- Ownership enforced on cancel, cancel-charges, booking/details, and my-bookings (id from token, not query).
- Supplier now settled at NET, not GROSS. Legacy refund-stranding cron unregistered. Expired-booking purge won't delete paid records.
- **CAB-M2:** payment collection is now floored at `max(gross, net)` for **both** channels (`collectPayment`), so a tampered `gross < net` can no longer make Klar collect less than it pays the supplier. (Full server-side markup *recompute* — replacing trust in the payload gross entirely — is deferred; it would desync the displayed price and is a larger refactor.)
- Invoice-PDF links kept as ungated capability URLs (`getBookingDetailsForInvoice`) — **residual**: guessable-id read, same class as hotel BUG-011.
- B2C review page: fare itemization, payment-mode label, and charge rounding corrected; B2C cabs API now sends the JWT.

**Hotels — B2C payment-reuse (fixed 2026-07-15):** the B2C review page stashed the Razorpay ids on `window` and never cleared them, so a later booking that skipped payment (hold / non-card) could reuse a consumed payment; the backend had no per-payment uniqueness. Fixed both sides:
- `KLAR_B2C_FRONTEND_NEW/src/pages/Hotels/HotelReviewBooking.tsx` — payment ids are now local to the booking attempt, never on `window`.
- `hotel-booking-service` + `cabs-service` — new `#assertPaymentNotReused` / `assertPaymentNotReused` guard rejects a `razorpayPaymentId` already attached to a *different* booking (different idempotencyKey) before verifying, in every B2C/GUEST branch. Also re-verified fixed since the original hotel audit: search rate-limit (BUG-005), guest-read identity stripping (BUG-011), and commit error sanitization (BUG-006).
- **Recommended follow-up:** add a `unique, sparse` index on `razorpayPaymentId` in both booking models once existing data is de-duped (hard guarantee against the narrow concurrent-reuse race the runtime check leaves open).

**Deliberately NOT auto-fixed (need a decision or a live stack, not a blind edit):**
- **CAB-F4** — whether B2C retail customers should be charged the "Admin Markup" at all is a pricing/product decision, not a bug.
- **Invoice-PDF capability hardening** — needs a random `publicToken` on the booking + changes to the emailed link/templates across services; invasive schema change.
- **Hotel residuals (§5): BUG-005/006/007/008/011/012/013** — a mix of infra (rate-limit + cache), pricing *semantics* (per-night vs total, markup-on-tax), a supplier cancel-preview implementation, and guest capability tokens. Each changes money math or adds infra in the already-remediated hotel service and should be verified against a running Mongo/Redis/payment stack before shipping.

---

## 0. Headline

The cabs backend was clearly rebuilt using the hardened hotel patterns — server-side Razorpay verification, a persistent `idempotencyKey` unique index, an atomic refund engine, a fail-closed Redis lock, and a reconciliation worker are all present and genuinely good. **But it never got the hotel module's authorization layer.** The result: the money-losing bugs in cabs are not in the pay path — they're in **who is allowed to cancel, read, and refund a booking**, plus two background jobs that fight each other.

Hotels, by contrast, has had its release-blockers fixed (payment verify, idempotency, fail-closed lock, room/meal block, email oracle rate-limit all now present). Remaining hotel items are lower-severity polish.

---

## 1. Cabs — Critical

### 🔴 CAB-C1 — Anyone can cancel (and trigger a refund on) anyone's booking
- **Affects:** B2B **and** B2C.
- **Routes:** `routes/index.ts:31-32`
  - `GET /amendment/charges` → **no auth middleware at all**.
  - `POST /amendment/cancel` → `optionalAuthenticateJWT`, and neither the controller (`controllers/amendment.controller.ts:14-21`) nor the service (`services/amendment.service.ts:78-136`) ever checks that the caller owns the booking.
- **What happens:** the only input is `bookingId` (`api/cabs.api.ts` → `cancelCabBooking(bookingId)`). Given any booking id, the service cancels the ride at TripJack and calls `refundService.settleCancellation`, which refunds the **original payer's** wallet/Razorpay. An attacker gains nothing financially, but can cancel every ride in the system and force refunds/penalties — a denial-of-service on the whole cabs book of business.
- **Contrast:** the hotel cancel path deliberately requires owner / guest-owner / admin before this exact destructive, money-moving action. Cabs is missing that gate.
- **Fix:** put `authenticateJWT` (or `optionalAuth` + explicit guest-owner check) on both routes; in the service load the booking and require `booking.userId === ctx.userInfo.id` (B2C) or `booking.agentId === ctx.agentId` (B2B), else `403`. Mirror `hotel-booking-service` `cancel.controller.ts`.

---

## 2. Cabs — High

### 🟠 CAB-H1 — `/booking/my-bookings` reads any user's history (IDOR)
- **Affects:** B2B + B2C. **Route:** `routes/index.ts:25` (`authenticateJWT`).
- The controller takes the id from the **query string**, not the token: `order.controller.ts:26` → `const userId = req.query.userId || req.body?.userId`, passed straight to `getBookingsByUserId` (`repositories/cabBooking.repository.ts:30`). Any logged-in user can set `?userId=<victim>` and read another customer's/agent's full booking history (names, phones, routes).
- **Fix:** derive the id from `req.user` only; ignore the query param entirely.

### 🟠 CAB-H2 — `/booking/details` leaks full supplier booking to anyone
- **Affects:** B2B + B2C. **Route:** `routes/index.ts:24` (`optionalAuthenticateJWT`).
- `order.service.ts:7-10` calls TripJack `getBookingDetails(bookingIds)` with no ownership filter and no local lookup. Anyone who knows/guesses a `bookingId` gets the full passenger PII and itinerary — worse than the hotel guest-read path, which at least strips identity fields.
- **Fix:** load the local `CabBooking` first, verify ownership (or a random `publicToken` for guest confirmation links), then fetch supplier details.

### 🟠 CAB-H3 — Supplier is paid GROSS (incl. Klar/agent markup), not NET
- **Affects:** B2B + B2C whenever markup > 0. **File:** `services/booking.service.ts:284, 463-471`.
- `settleSupplier` calls `tripJackCabsProvider.createPayment({ amount: grossAmount, … })`. `grossAmount` is the customer-facing price **including markup**; the supplier is only owed `netAmount` (`validatedPrice`, the fresh quote). Paying gross tells TripJack to debit Klar's TripJack credit account by the full retail price, handing the margin back to the supplier.
- **Fix:** settle the supplier with `netAmount` (the validated fresh total), not `grossAmount`. (Verify against TripJack's expected `PAID_FOR_ORDER` amount — the hotel path pays the raw supplier net, `commit.service.ts` phase 4.)

### 🟠 CAB-H4 — Two reconciliation jobs conflict; one strands refunds
- **Affects:** B2B + B2C. **Files:** `cron/jobs/checkBookingStatus.job.ts` **and** `workers/ReconciliationWorker.ts` (both started in `server.ts:20-21`).
- `checkBookingStatusJob` sweeps `PENDING` bookings and, on supplier `FAILED` **or** `CANCELLED`, sets the local status to `FAILED` and issues **no refund** (`checkBookingStatus.job.ts:62-71`). It also mislabels a supplier `CANCELLED` as `FAILED`.
- The good `ReconciliationWorker` only revisits `INITIATED / PENDING / SUPPLIER_PENDING` (`ReconciliationWorker.ts:41-50`) — it never looks at `FAILED`. So once the legacy job flips a paid booking to `FAILED`, the customer's money is stranded with no refund path.
- **Fix:** delete the legacy `checkBookingStatusJob` (the `ReconciliationWorker` supersedes it and refunds correctly), or route its terminal-failure transitions through `refundService.refundFailedBooking`.

---

## 3. Cabs — Medium

### 🟡 CAB-M1 — Daily delete can erase a paid, unreconciled booking
- **File:** `cron/jobs/deleteExpiredPendingBookings.job.ts:38-41` → `repository.deleteExpiredBookings(PENDING, -24h)` hard-deletes every `PENDING` booking older than 24h. A booking that was paid but never reconciled to a terminal state (reconciliation worker down/slow) is destroyed — money, audit trail, and the `idempotencyKey` guard all gone.
- **Fix:** never delete a booking that has `razorpayPaymentId` or `paymentMethod` set; restrict the purge to `INITIATED` records with no `bookingId` and no payment instrument.

### 🟡 CAB-M2 — B2B markup trusted from the client payload
- **File:** `services/booking.service.ts:178-189, 235-237`. B2B `grossAmount` comes straight from `payload.pricingInfo.grossAmount`; the server never recomputes markup, even though `WalletUtil.getMarkupRules` exists (`utils/wallet.util.ts:123`) and is unused in the booking path. An agent (or tampered client) can misstate markup. Impact is limited because the agent debits their own wallet, but it also feeds the supplier-settle amount (see CAB-H3).
- **Fix:** compute B2B markup server-side from `getMarkupRules`, like the hotel commit path.

### 🟡 CAB-M3 — B2C cabs API sends no auth token
- **File:** `KLAR_B2C_FRONTEND_NEW/src/api/cabs.api.ts:3-9` creates `cabsAPI` with **no** `setupInterceptors` (the B2B copy has it, `KLAR_B2B_FRONTEND/src/api/cabs.api.ts:15`). A logged-in B2C customer's call to `/booking/my-bookings` (which requires `authenticateJWT`) carries no `Authorization` header, so it relies entirely on cookies/`withCredentials` and will 401 if the backend expects the header.
- **Fix:** attach the customer JWT interceptor to the B2C `cabsAPI` instance.

---

## 4. Cabs — Frontend (B2C review/pay page)

**File:** `KLAR_B2C_FRONTEND_NEW/src/pages/Cabs/CabReviewPage.tsx`

### 🟡 CAB-F1 — Fare summary double-counts markup (line items don't sum to total)
- Lines `1192-1213`: the sidebar shows **"Admin Markup"** as its own line **and** folds the same markup into the **"Base Fare"** line (`(baseFare + cabMarkupAmount)`). Markup + (base+markup) + tax ≠ Grand Total (`finalCabPrice = base + tax + markup`). The customer sees an itemization that doesn't add up.
- **Fix:** show Base Fare as `baseFare` alone; keep markup as its single line.

### 🟡 CAB-F2 — Confirmation always says "Payment Mode: Wallet"
- Line `494`: the success screen hardcodes `Wallet`, but B2C pays via Razorpay. Misleading receipt.
- **Fix:** render the actual method used.

### 🟡 CAB-F3 — Razorpay is charged before the booking precheck, and the amount can round below gross
- `handleBooking` charges Razorpay (`:203`) **before** `createCabBooking` (`:302`). If the backend precheck then rejects (price change / sold out), the customer is charged and relies on auto-refund.
- `amount: Math.round(totalAmount)` (`:196`) can round **down** below the unrounded `grossAmount` sent in the payload (`:285`), so the backend's `capturedAmount >= max(gross,net)` check (`booking.service.ts:420-427`) can reject a payment the customer actually made → forced refund of a valid booking.
- **Fix:** send an integer gross and charge exactly that (round the payload gross the same way, or `Math.ceil`); ideally run a precheck endpoint before taking payment.

### 🟢 CAB-F4 — B2C customers are shown/charged an "Admin Markup" (business check)
- The page fetches agent markup rules (`getMyMarkups('CABS')`) and adds them to a retail customer's fare. Confirm B2C is meant to carry agent markup at all.

---

## 5. Hotels — status since the fix commit

Verified **fixed** in `hotel-booking-service/src`:
- **Payment verified server-side** for B2C/guest — `commit.service.ts:388, 638` (`PaymentUtil.verifyRazorpayPayment`, throws `PAYMENT_UNVERIFIED`). *(was BUG-001)*
- **Idempotency key + unique index** with E11000 replay — `commit.service.ts:199-241`. *(was BUG-003)*
- **Lock fails closed** — `RedisLockUtil.ts:56-57` (`LOCK_FAIL_OPEN` opt-in only). *(was BUG-002)*
- **Room/meal mismatch now blocks** — `ValidationEngine.ts:75-106` throws `ROOM_CHANGED`. *(was BUG-004)*
- **Email existence oracle rate-limited** — `routes/index.ts:73` (`emailCheckLimiter`). *(was BUG-010)*

Still open (lower severity — see `HOTEL_MODULE_AUDIT.md`): BUG-005 search rate-limit/cache, BUG-006 upstream error leakage, BUG-007/008 per-night vs total & markup-on-tax, BUG-011 guest booking read over a guessable ObjectId, BUG-012 RateGain cancel-charge preview, BUG-013 supplier-call timeouts. These apply equally to B2B and B2C.

---

## 6. Fix priority

| Pri | Item | Effort |
|---|---|---|
| P0 | CAB-C1 ownership check on cancel + charges | 0.5–1 d |
| P0 | CAB-H1 my-bookings from token, not query | 0.25 d |
| P0 | CAB-H4 remove/fix the legacy status cron (stranded refunds) | 0.5 d |
| P1 | CAB-H2 ownership on booking/details | 0.5 d |
| P1 | CAB-H3 settle supplier at NET not GROSS | 0.5 d (verify) |
| P1 | CAB-M1 don't delete paid PENDING bookings | 0.25 d |
| P2 | CAB-M2 server-side B2B markup | 0.5 d |
| P2 | CAB-M3 B2C API auth token | 0.1 d |
| P2 | CAB-F1/F2/F3 fare display, payment-mode, rounding | 0.5 d |
| P3 | Hotel residual BUG-005/006/007/008/011/012/013 | per hotel audit |

**P0 cluster ≈ 1.5 dev-days closes the release-blocking authorization + refund-stranding gap.**
