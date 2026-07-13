# 🏨 Hotel Module — Production Readiness Audit (Single Report)

**Scope:** Hotels module only — `hotel-search-service`, `hotel-booking-service`, and `KLAR_B2B_FRONTEND/src/features/hotels`. Flights / Cabs / Buses / Holidays / Visa / Insurance are out of scope.
**Deployment:** AWS + pm2 (per owner). Deployment infra itself not audited — code and business logic only.
**Date:** 2026-07-13
**Method:** Deep code trace of the full money path, plus targeted read-only checks.

> **Why no live bookings were executed:** both `.env` files carry **production** TripJack, RateGain and Razorpay credentials. Running `commit` / `confirm` / `cancel` / `refund` would create **real bookings and real charges**. Those flows are audited by reading the exact code, which is where the financial risk lives. Every finding cites `file:line`.

---

## 1. Executive summary

The hotel backend is **more mature than typical** — the refund engine, cancellation state machine, dedup, and geofencing are genuinely well-designed. But there is **one release-blocking, revenue-critical hole**: B2C bookings are committed with **no server-side payment verification**. Combined with a **fail-open booking lock** and **no persistent idempotency key**, the booking path can lose money in three independent ways.

**Verdict: NOT production-ready for B2C until BUG-001, BUG-002, BUG-003 are fixed.** Search and B2B paths are in much better shape.

### Scorecard (1–10)

| Area | Score | Note |
|---|---|---|
| Homepage / Search entry | 7 | Solid; input validation present (`hotels.service.ts:38-64`) |
| Search algorithm & fan-out | 8 | Concurrent, partial-return, dedup — strong |
| Search results / filter / sort | 6 | Correct but recomputes pricing 3× per hotel; per-night mismatch |
| Pricing / markup engine | 5 | Works, but per-night ≠ total; markup on taxes; see BUG-007/008 |
| Hotel details / products | 6 | Not deeply traced this pass |
| Checkout / commit | **2** | No payment verification (BUG-001) |
| Booking integrity | **3** | Fail-open lock + no idempotency (BUG-002/003) |
| Cancellation flow | 7 | Ownership-checked, poll-confirmed, multi-format policy parsing |
| Refund flow | 8 | Atomic claim, idempotent, correct instrument — best-in-class here |
| Booking history / details | 6 | Ownership check good; anonymous capability-URL is weak (BUG-011) |
| API design | 5 | Inconsistent envelopes; upstream error leakage |
| Security / authz | **3** | Payment trust + open endpoints (BUG-001/005/010) |
| Observability | 4 | Redis errors fully suppressed (BUG-009) |
| Code quality / maintainability | 7 | Readable, well-commented, clear separation |
| Scalability | 6 | 15 s event-loop holds, no search cache |

**Overall production readiness: ~55%.** (Blocked almost entirely by the B2C commit path — fix the 3 criticals and this jumps to ~80%.)

---

## 2. Critical bugs (release-blocking)

### 🔴 BUG-001 — B2C bookings commit with **zero server-side payment verification**
- **Severity:** Critical (direct, unbounded revenue loss / fraud)
- **Endpoint:** `POST /api/commit` — `optionalAuthenticateJWT`, i.e. **guests allowed** (`routes/index.ts:56`)
- **Files:** `controllers/commit.controller.ts:86-87`; `services/commit.service.ts:354-357` (TripJack B2C) and `:578-581` (RateGain B2C)
- **What happens:** For B2C/GUEST the code just sets `paymentProcessed = true`. `razorpayPaymentId` / `razorpayOrderId` come straight from the request body and are never checked. A repo-wide grep for `razorpay|signature|createHmac|verify|capture` shows the booking service has **no** Razorpay signature check, **no** amount/capture check, and **no** call to `payment-service` to confirm payment — the only Razorpay calls are *refunds*.
- **Exploit (trace):** call `POST /commit` directly with a real `optionId` (from a normal precheck), `totalPrice: 1`, and a fabricated `razorpayPaymentId`. `#commitTripJack` re-prechecks, pays the supplier `freshPrecheck.supplierNet` (real net, e.g. ₹8,000) at `commit.service.ts:360,371`, and confirms. Klar paid ₹8,000; the customer paid ₹1.
- **Fix (exact):** before `paymentProcessed = true` in **both** B2C branches, verify the payment:
  ```ts
  const pay = await PaymentUtil.verifyRazorpayPayment({
    orderId: payload.razorpayOrderId,
    paymentId: payload.razorpayPaymentId,
    expectedAmount: finalPrice,
  });
  if (!pay.verified || pay.capturedAmount + 0.01 < finalPrice)
    throw new StructuredError("PAYMENT_UNVERIFIED", "Payment could not be verified.");
  paymentProcessed = true;
  ```
  Add `PaymentUtil.verifyRazorpayPayment` → call `payment-service` guarded by `INTERNAL_SERVICE_KEY` (already in `.env`); do HMAC-SHA256 of `order_id|payment_id` against `RAZORPAY_KEY_SECRET`, and confirm `status === "captured"` and amount.
- **Regression risk:** Medium — frontend must always send the 3 Razorpay fields; roll out behind `ENFORCE_PAYMENT_VERIFY`. **Effort:** 1–2 days.

### 🔴 BUG-002 — Booking lock **fails open** on Redis error
- **Severity:** Critical (duplicate bookings / double supplier charge)
- **File:** `services/RedisLockUtil.ts:42-46` — `acquireLock` catches any error and `return true`.
- **Effect:** during any Redis outage/slowness, every concurrent `commit` "acquires" the lock, so the sole duplicate guard is disabled exactly when the system is degraded.
- **Fix:** fail closed (reject with retry) **or** rely on a DB unique idempotency key (BUG-003) so the lock is only an optimization. Also expose Redis-down via `/health`. **Effort:** 0.5 day.

### 🔴 BUG-003 — No persistent idempotency key → retries create duplicate bookings
- **Severity:** Critical
- **Files:** `services/commit.service.ts:197` (lock key), `RedisLockUtil.ts:78` (TTL 30 s), `repositories/hotelBooking.repository.ts` (no unique idempotency index)
- **Effect:** the only dedupe is a 30 s Redis lock, while TripJack's own book is async up to 180 s (`commit.service.ts:19-20`). A client/network retry after the lock expires re-books. Also, guest lock key collapses `agentId` to the literal `"guest"` (`:197`), so two guests booking the same `optionId` collide.
- **Fix:** add `idempotencyKey` on `Booking` + `unique` sparse index; on duplicate key return the existing booking. Keep Redis lock as fast path. **Effort:** 1 day.

---

## 3. High-severity findings

### 🟠 BUG-004 — Room/meal mismatch at precheck only **warns**, never blocks
- **File:** `services/ValidationEngine.ts:60-83` — room-type and meal-plan mismatches `console.warn` and continue; only price-increase-beyond-tolerance (`:116`) and `available === false` (`:42`) actually throw.
- **Effect:** if the supplier remaps the option to a different room/board at book time, the customer is silently booked into something other than what they paid for → complaints/chargebacks.
- **Fix:** promote the two `console.warn` branches to `throw new StructuredError("ROOM_CHANGED", …)` with a tolerance that ignores pure formatting differences. **Effort:** 0.5 day.

### 🟠 BUG-005 — Public `POST /hotels/search` is unauthenticated **and** unthrottled
- **Files:** `hotel-search-service/src/routes/index.ts` (`/hotels/search` and `/` → `searchHotels`, no auth/rate-limit); `app.ts` has CORS only, no `helmet`, no rate limiter, no body-size cap.
- **Effect:** every call fans out to TripJack **and** RateGain live and holds the event loop up to 15 s (`hotels.service.ts:179-186`). Trivial to exhaust supplier quotas / rack up cost / DoS.
- **Fix:** `express-rate-limit` (Redis store) on search routes + a 60–120 s Redis cache keyed by `destination+dates+rooms+providers`. **Effort:** 0.5–1 day.

### 🟠 BUG-010 — `GET /bookings/check/:email` has **no authentication**
- **File:** `routes/index.ts` (`router.get("/bookings/check/:email", checkBookingsByEmail)` — no middleware); `controllers/bookings.controller.ts:5-36`.
- **Effect:** an open boolean oracle — anyone can ask "does `<email>` have bookings with Klar?" (privacy leak / user enumeration).
- **Fix:** require a rate limit + captcha or a signed token; at minimum throttle hard and don't confirm existence to arbitrary callers. **Effort:** 0.5 day.

---

## 4. Medium-severity findings

### 🟡 BUG-006 — Upstream supplier errors leaked to clients
`controllers/hotels.controller.ts:16-21`, `confirm.controller.ts:73-79`, `commit.controller.ts:143-160`, `cancel.controller.ts:92-99` forward `error.response?.status` and raw supplier `description`. → Sanitize to stable internal codes; log raw server-side only.

### 🟡 BUG-007 — `perNightPrice` never reconciles with the total
`utils/pricing.util.ts:100` computes `perNightPrice = basePrice / nights` (excludes tax **and** agent markup), while `finalTotalPrice = totalPrice + markupAmount` includes both (`:98`). Any "₹X/night × N nights" UI won't match the total. → Define per-night as `finalTotalPrice / nights`, or label it clearly "base rate/night, excl. taxes & fees". Consumed at `hotels.service.ts:493`.

### 🟡 BUG-008 — Percentage markup applied on **tax-inclusive** amount
`utils/pricing.util.ts:90` — `markupAmount = totalPrice * pct/100` where `totalPrice = base + taxes`, so agent markup is charged on government taxes too. → Compute on `basePrice` unless a documented `MARKUP_ON_GROSS` flag is set.

### 🟡 BUG-009 — All Redis errors silently swallowed
`RedisLockUtil.ts:14-16` — empty error handler. With BUG-002, a Redis outage becomes invisible (locks silently stop working, nothing alerts). → Rate-limited error log + health metric.

### 🟡 BUG-011 — Guest booking-details is a capability URL over a **guessable** ObjectId
`controllers/bookings.controller.ts:159,172-177` — when `req.user` is undefined, access is allowed to anyone who knows the booking `_id` (identity fields are stripped, which is good). But `_id` is a Mongo ObjectId (timestamp + machine + counter) — semi-predictable, not a secret. → Issue a random `publicToken` (e.g. 128-bit) for guest confirmation links instead of exposing `_id`.

### 🟡 BUG-012 — RateGain cancellation-charge preview is unimplemented
`services/cancel.service.ts:723-729` returns "unsupported" for RG. So RG cancellations proceed without a computed penalty preview; if `cancelChargesInfo` is null, `resolveCancellationRefund` parks the booking in `MANUAL_REVIEW` (`refund.service.ts:82-91`). → Implement RG charge calc (the policy data already flows through `deriveRefundable`).

### 🟡 BUG-013 — 15 s partial-return holds the event loop and orphans supplier promises
`hotels.service.ts:179-189` — `Promise.race` returns at 15 s but the still-pending supplier promises keep running unbounded in the background. Under load this accumulates. → Attach an AbortController/timeout to the supplier axios calls (there's a `TRIPJACK_TIMEOUT` env already) and cancel losers.

---

## 5. What's genuinely good (keep it)

- **Refund engine** (`refund.service.ts`): atomic `claim()` via `findOneAndUpdate` with stale-claim reclaim (`:272-308`), idempotent, instrument derived from the booking not the caller (`:255-264`), never closes a booking to CANCELLED/FAILED until money is provably back. This is production-grade.
- **Cancel authorization** (`cancel.controller.ts:12-78`): correctly requires owner/guest-owner/admin; anonymous is never enough for a destructive, money-moving action. (Contrast with the read path, which intentionally allows capability-URL reads.)
- **Cancellation policy parsing** (`cancel.service.ts:570-703`): handles 4 TripJack policy shapes with sane "past all windows → max penalty" fallback.
- **`deriveRefundable`** (`pricing.util.ts:194-245`): conservative, no fabrication, flags `unknown` for the UI instead of a false promise.
- **Dedup + dynamic geofence** (`hotels.service.ts:191-267`, `deduplicator.ts`): "cheaper wins" merge, largest-supplier inventory count (never a double-counted sum), Haversine radius filter that keeps no-coord hotels rather than dropping them.
- **Input guard before supplier round-trip** (`hotels.service.ts:38-64`): rejects bad dates/rooms early.

---

## 6. Flow analyses

### Search flow (`POST /api/search/hotels/search`)
Frontend → `hotels.controller.searchHotels` → `hotelsService.searchHotels`:
1. Markup rules loaded only if a token is present (`:28`) — B2C gets `[]` (markup 0). ✅
2. Early validation guard (`:38-64`). ✅
3. Geo resolution: text (OpenCage) is authoritative; legacy `GEO:` tokens ignored when text resolves (`:83-117`). ✅ good defensive design.
4. Concurrent fan-out, 15 s partial return (`:157-186`). ⚠️ BUG-013.
5. Dedup + geofence + facets + filter + sort + markup-bake (`:191-499`). ⚠️ pricing recomputed 3× per hotel (filter, sort, final map) — O(n) redundant; cache the enriched price once per hotel. ⚠️ BUG-007/008.
6. `inventoryCount` uses pre-geofence supplier totals while results are geofenced → "Showing 40 of 6,179" can overstate. Display-only, low severity.

### Booking flow (`POST /api/commit`)
`commit.controller` compiles a unified payload → `commitService.commit` (Redis lock) → provider-specific `#commitTripJack` / `#commitRateGain`:
- Phase 1 precheck + `ValidationEngine.validate` (price-drop passes savings to customer; price-rise beyond tolerance throws). ✅ but room/meal only warns → BUG-004.
- Phase 2 markup: B2B via `WalletUtil.getMarkupRules` + coupon; B2C trusts `sellingRate` from payload. ⚠️ **payment never verified** → BUG-001.
- Phase 3 wallet debit **B2B only**; B2C `paymentProcessed = true`. ⚠️ BUG-001.
- Phase 4 supplier paid the **raw net** (`freshPrecheck.supplierNet`), platform markup stripped. ✅ correct margin handling.
- Phase 5 lean booking saved; TripJack polled fire-and-forget with a 2-min status cron as the safety net (`:443-451`). ✅ resilient. On B2B failure, wallet is rolled back (`:463-471`). ✅ (B2C failure has nothing to roll back precisely because nothing was collected — another face of BUG-001.)

### Cancellation & refund flow (`POST /api/cancel`)
Ownership-checked → `getCancelCharges` (penalty depends on *when* asked, captured now) → supplier cancel → **ack ≠ cancellation**: booking goes `CANCELLATION_PENDING`, a poll flips it to `CANCELLED` and calls `refundService.settleCancellation` only on terminal confirmation (`cancel.service.ts:250-291`, `refund.service.ts:76-98`). `ENABLE_AUTO_REFUNDS=false` cleanly defers to manual CRM refund. ✅ Strong. Gap: RG charge preview (BUG-012).

---

## 7. Prioritized fix plan

| Priority | Item | Effort |
|---|---|---|
| P0 | BUG-001 server-side payment verification (B2C) | 1–2 d |
| P0 | BUG-003 idempotency key + unique index | 1 d |
| P0 | BUG-002 lock fail-closed / DB-backed | 0.5 d |
| P1 | BUG-004 block room/meal mismatch | 0.5 d |
| P1 | BUG-005 rate-limit + cache search | 0.5–1 d |
| P1 | BUG-010 auth on `/bookings/check/:email` | 0.5 d |
| P2 | BUG-006 sanitize error responses | 0.5 d |
| P2 | BUG-007/008 pricing consistency | 0.5 d |
| P2 | BUG-009 Redis observability | 0.25 d |
| P2 | BUG-011 guest publicToken | 0.5 d |
| P3 | BUG-012 RG cancel charges | 1 d |
| P3 | BUG-013 supplier call timeouts | 0.5 d |

**P0 cluster ≈ 3–4 dev-days closes the entire release-blocking gap.**

---

## 8. Not covered this pass (needs a running local stack: Mongo + Redis + auth/payment/wallet)
- Frontend runtime UX (loading/skeleton/empty/error states, re-renders, bundle size) — static review only.
- Mongo index coverage & aggregation performance on `bookings` / `hotels`.
- `precheck.service.ts`, `amend.*`, `special-requests`, wallet/coupon math edge cases, and `products` (room/rate-plan) path — traced only at the interface level.
- Concurrency behaviour under real load (double-book reproduction needs a live Redis + two clients).

These are quality/perf items, not go-live blockers. The go-live blockers are all in §2.
