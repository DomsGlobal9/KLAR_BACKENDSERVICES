# TripSafe Insurance Service — CTO Decisions Pending

**Branch:** `audit/tripsafe-insurance-hardening` · **Base:** `aac5b43` · **Head:** `2f54f80`
**Source:** rounds 1 and 2 of the TripSafe audit. Full evidence in `AUDIT-FINDINGS.md`.

> ## ⚠️ STATUS — superseded in part
>
> This document was written as a decision list when nothing in it was implemented. **The owner has since approved and I have implemented 16 of the 24 items** (round 3, commits `5897818` … `2f54f80`). Each entry below still describes the problem and the design accurately; the **Status** column in the summary table is the current truth.
>
> **Implemented:** B1, B2, B3, B4, B5, C3, C4, D1, D2, D3, D5, E1, E2, E3, E4, E6 — plus the student coverage-duration decision.
>
> **Explicitly kept as-is by the owner:** C1 (`B2C_PORTAL` bypass), C2 (`/search` + `/review` open), A2 (production URL).
>
> **Still open:** A1, A3 (questions for TripJack), D4 (needs one captured response), E5 (absorbed into C4), F1 (needs live UAT credentials).

Each item states what was happening, what the fix changed, and what could break — enough to review without reopening the audit.

---

## How to use this document

Items are grouped by the kind of decision required:

- **§A — Blocked on TripJack.** Cannot be decided internally. Send §A1 to TripJack; three items depend on the answers.
- **§B — Yes/no, financial or data integrity.** The consequential ones.
- **§C — Yes/no, security.** Includes the highest open risk in the service.
- **§D — Yes/no, reliability.** Correctness under failure, not under load.
- **§E — Low-risk cleanups.** Safe, small, uncontroversial; batch-approve or ignore.

Severity: **P0** production/data/security critical · **P1** functional or financial · **P2** reliability/maintainability · **P3** technical debt.

---

## Summary decision table

| ID | Item | Sev | API change | DB change | Status |
|---|---|---|---|---|---|
| A1 | Confirm TripJack re-book behaviour on the same `bid` | — | — | — | **OPEN — ask TripJack.** B4 now blocks retries locally, so this only sets residual severity |
| A2 | Confirm production domain (`api.tripjack.com` vs `tripjack.com`) | P2 | No | No | **KEPT AS-IS by owner** — no change made |
| A3 | Resolve 4 self-contradictions in doc v6.0 | P2 | Possibly | No | **OPEN — ask TripJack.** Student durations pinned by owner decision |
| B1 | Review→Book consistency store | P1 | No | **YES — new collection** | **IMPLEMENTED** `5897818`, `ace5623` |
| B2 | Booking amount vs reviewed fare | P1 | No | Uses B1 | **IMPLEMENTED** `ace5623` — active only when the fare is located |
| B3 | Traveller count / identity vs Review | P1 | No | Uses B1 | **IMPLEMENTED** `ace5623` |
| B4 | Booking idempotency (reserve-then-book) | P1 | Adds 409 | No new fields | **IMPLEMENTED** `ace5623` |
| B5 | `dob` vs `age` cross-check | P2 | No | No | **IMPLEMENTED** `ace5623` — log-only, as recommended |
| C1 | `B2C_PORTAL` authentication bypass | **P0** | Yes | No | **KEPT AS-IS by owner** — highest open risk |
| C2 | `/search` and `/review` unauthenticated | P2 | Yes | No | **KEPT AS-IS by owner** — mitigated by D3 |
| C3 | `JWT_SECRET` hardcoded fallback | P2 | No | No | **IMPLEMENTED** `5dded59` |
| C4 | TripJack error messages never reached callers | P2 | Yes (`message` text) | No | **IMPLEMENTED** `9cd92cb` |
| D1 | Polling does not survive restart | P1 | No | No | **IMPLEMENTED** `f73e727` |
| D2 | Mongo connection failure does not stop startup | P2 | No | No | **IMPLEMENTED** `f73e727` |
| D3 | Rate limiting not mounted (40 RPM SLA) | P2 | Adds 429 | No | **IMPLEMENTED** `4200f7d` — 100/min per IP |
| D4 | `coverageStart`/`coverageEnd` never populated | P2 | No | No | **IMPLEMENTED** `ace5623` via B1 — the booking-details backfill remains unnecessary |
| D5 | No `unhandledRejection` handler | P3 | No | No | **IMPLEMENTED** `f73e727` |
| E1 | Multiple products per plan not rejected | P2 | No | No | **IMPLEMENTED** `5897818`, `ace5623` |
| E2 | Duplicate traveller `id` not rejected | P2 | No | No | **IMPLEMENTED** `ace5623` |
| E3 | `deliveryInfo` not validated | P2 | No | No | **IMPLEMENTED** `ace5623` |
| E4 | `source` field never populated | P3 | No | No | **IMPLEMENTED** `ace5623` |
| E5 | Dead `msg` variable in provider | P3 | No | No | **IMPLEMENTED** — absorbed into C4 `9cd92cb` |
| E6 | Duplicate index declaration on `bookingId` | P3 | No | No | **IMPLEMENTED** `ace5623` |
| F1 | Full UAT / documentation test matrix | P2 | No | No | **OPEN** — needs live UAT credentials and confirmation numbers |

### Round-3 deployment notes

- **New collection `insurancereviewcontexts`** is created on first write. No migration, no existing data touched. Rollback is `git revert` plus an optional `db.insurancereviewcontexts.drop()`.
- **`POST /book` can now return 409** when a booking for the same review is already in progress or complete. Clients should treat it as "already booked", not as a failure to retry.
- **Error response `message` text changes** on upstream failures — callers now see the real TripJack reason instead of the generic fallback. Anything string-matching the old text needs checking.
- **The service now exits** on a failed Mongo connection, and in production if `JWT_SECRET` is unset. Both are set in the `.env` reviewed during this audit; **confirm the same on the production host before deploying.**
- **Rate limiting defaults to 100 req/min per IP**, tunable with `RATE_LIMIT_PER_MIN`. Raise it if legitimate burst traffic is higher.
- **Reconciliation runs every 60s** in-process, disable with `RECONCILE_ENABLED=false`. Safe with multiple instances (duplicate polling, idempotent writes); add a lease field if the upstream call volume matters.
- **Review→Book validation is fail-open.** Reviews created before this deploy have no stored context and book exactly as they do today. Watch the logs for mismatch rejections before considering any tightening.

---

# §A — Blocked on TripJack

## A1 · Does a repeat Book on the same `bid` create a second policy?

**Severity:** gates B4 · **Decision:** send the question

`book.service` calls TripJack **first**, then writes to MongoDB. The unique index on `InsuranceBooking.bookingId` therefore prevents a duplicate **row**, not a duplicate **policy** — on a retry the second upstream booking already exists before the constraint fires.

The doc (p. 28) says `bookingId` is "a system generated unique ID" but never states what happens if the same `bid` is booked twice. No captured evidence exists either way.

- **If TripJack rejects the second call:** residual risk is one wasted request. B4 drops to **P3**.
- **If TripJack accepts it:** two policies, two wallet debits, one local record — and the second policy is invisible to booking details, listing and cancellation, so it cannot be refunded through the API. **P1, financial.**

**Ask TripJack:** *"If we POST `/oms/v1/insurance/book` twice with the same `bookingId` from a single Review, does the second call return an error, or does it create a second policy and a second debit?"*

## A2 · Which production domain is correct?

**Severity:** P2 · **Decision:** confirm, then almost certainly leave the code alone

Three sources disagree:

| Source | Value |
|---|---|
| Doc v6.0 §2, p. 7 | `https://tripjack.com` |
| `src/config/env.ts` fallback (in force today) | `https://api.tripjack.com` |
| `.env` → `TRIPJACK_PROD_BASE_URL` | `https://tripjack.com` — **read by nothing** |

The `.env` value is inert: `env.ts` resolves the production base URL from `TRIPJACK_BASE_URL`, so the fallback wins. Deliberately left unchanged in both rounds.

**Do not change this in the same release as the API-key alias fix (F-01, commit `78a376f`).** If the integration then fails, you cannot tell which change caused it. Confirm the domain, then change it alone if needed.

## A3 · Four self-contradictions in doc v6.0

**Severity:** P2 · **Decision:** confirm the authoritative reading

In every case the implementation takes the **more permissive** reading, so nothing that works today is rejected. Nothing was changed on the strength of a conflicted source.

| # | Source A | Source B | Code today | If A is authoritative |
|---|---|---|---|---|
| 1 | §4 p. 87 — travellers **above 70** not permitted | Search FAQ p. 14 — valid range **0–75** | `0–75` | Searches for ages 71–75 must start failing |
| 2 | §4 p. 87 — coverage **must not exceed 90 days** | Search matrix p. 89 — Standalone **max 180 days** | `180` | Coverage of 91–180 days must start failing |
| 3 | p. 66 — student `cd` 30/60/90/180/**360**/730/1095 and "Important Note" 180/365/730/1095 | Matrix p. 89 — 30/60/90/120/180/240/270/365/**735** | superset, incl. `730` | `735` vs `730` is likely a doc typo — confirm |
| 4 | p. 4 & p. 83 — AMT covers **30/45/60/90** days | Matrix p. 89 + UAT §4.4 — **30/45/60 only**, others must error | `30/45/60` | A legitimate 90-day AMT search is being rejected locally |

**#4 is the one that can lose you business today** — the code follows the stricter UAT rule, so if 90-day AMT is a real product, those searches are being refused.

---

# §B — Financial and data integrity

## B1 · Review → Book consistency store *(Proposal A)*

**Severity:** P1 · **Requires: new MongoDB collection** · **Recommendation: APPROVE**

### Current behaviour
`/review` and `/book` are independent stateless HTTP requests. The trusted values exist only inside the Review *response*, which is returned to the client and discarded. At Book time the process holds nothing but `req.body`. The client is trusted for `plid`, `pid`, the traveller set, ages, and the amount charged.

Doc p. 23 is explicit: *"All submitted data must exactly match the information provided in the Insurance Review Request."* The service cannot currently enforce a single word of that.

### Why no existing structure can carry it
- `InsuranceBooking` documents are created **at book time** — nothing exists to read.
- Writing a review-time row into `InsuranceBooking` collides at book time: `bookingId` is `required + unique` and `book.service` does `new InsuranceBookingModel(...).save()`, which would fail on duplicate key and take the orphan path (F-07). It would also make abandoned reviews surface as PENDING bookings in `GET /bookings` — a public-facing change.
- Re-calling Review at book time would mint a second `bid` and double the upstream call.

### Proposed schema
```text
InsuranceReviewContext {
  bid:             String   // unique index
  plid:            String
  pid:             String
  travellerCount:  Number
  travellers:      [{ id: Number, age: Number, dob: String }]
  sd:              Date
  ed:              Date
  reviewedAmount:  Number
  createdAt:       Date     // TTL index, 24h
}
```

### Behaviour
- **Write:** `review.service`, after a successful upstream Review. Best-effort — a write failure never fails the Review.
- **Read:** `book.service`, keyed on `payload.bookingId`.
  - **Context absent → proceed exactly as today (fail-open).** In-flight reviews at deploy time, and anything the TTL has expired, behave unchanged. Nothing that works today breaks.
  - **Context present → compare** `plid`, `pid`, traveller count, per-traveller `age`/`dob`, and amount. Mismatch → 400 before the upstream call.
- Ship fail-open, watch a mismatch counter in production, then decide whether to fail closed. **Do not fail closed on day one.**

```text
Public API change:      NONE — no field renamed, added or made mandatory
Migration:              NONE — new collection, created on first write
Existing data:          untouched
Downtime:               none
Rollback:               revert the commit; optionally drop the collection
Infrastructure:         none
Diff size:              ~1 new model + ~2 service changes
```

**Residual risk:** a client that never calls Review, or that waits out the 24h TTL, is still unvalidated. That is inherent to fail-open and is the price of not breaking live traffic.

## B2 · Booking amount vs reviewed fare

**Severity:** P1 · **Depends on B1 and A3** · **Recommendation: APPROVE, but ship it last**

Today only `amount > 0` is enforced (commit `53c4dba`). The amount charged is whatever the client sends. With B1 in place, comparing `paymentInfos[0].amount` against `reviewedAmount` is a two-line check.

**Blocker before wiring it:** the exact path of the reviewed total fare in the Review response is **not established**. The doc lists `TF` (Total Fare) under the fare component but shows no complete Review response body, and the Postman collection stores no example responses. The amendment response shows `tfd.ifc.TF` as the payable total, which is suggestive but is a different endpoint.

**I will not guess a field path on a money check.** Capture one real UAT Review response, confirm the path, then enable this. Ship B1's `plid`/`pid`/count/identity comparisons first — those use unambiguous fields.

## B3 · Traveller count and identity vs Review

**Severity:** P1 · **Depends on B1** · **Recommendation: APPROVE with B1**

Prevents reviewing 4 travellers and booking 3 or 5, and reviewing one set of people while booking another. Doc p. 29 shows TripJack returns error `1134` for a traveller-count mismatch, so this is a documented upstream rule we currently cannot pre-check.

Comparison fields: traveller `id`, `age`, `dob`. Names are deliberately excluded — casing and title conventions vary between Review and Book payloads and would produce false rejections.

## B4 · Booking idempotency *(Proposal B)*

**Severity:** P1 if A1 comes back "creates a second policy", else P3 · **Recommendation: APPROVE after A1**

### Duplicate scenario
`POST /book` → TripJack SUCCESS → response lost to a network timeout → client retries with the same body → second upstream booking against the same `bid`.

The axios timeout is 60 s while the documented Book SLA is under 1 s, so the realistic triggers are a client-side timeout or a double-click, not our own timeout.

### Current protection
One unique index on `InsuranceBooking.bookingId`, applied **after** the upstream call. No idempotency key, no request id, no lock, no shared state between PM2 instances.

### Proposed design — reserve-then-book
Insert the `InsuranceBooking` row with status `PENDING` **before** calling TripJack. A duplicate-key error means the booking is already in flight or complete → return **409** without calling TripJack. MongoDB enforces this across every instance, so no Redis and no distributed lock are needed. This reuses the index that already exists.

```text
API change:             adds 409 (new status semantic); happy path unchanged
Frontend change:        not required for correctness; SHOULD treat 409 as "already booked"
DB schema change:       NO new fields — reuses the existing unique index
Infrastructure:         NONE
Rollback:               revert one commit; write order returns to book-then-save
```

**Side effect to accept:** rows are created for bookings that then fail upstream. They stay `PENDING` and are cleaned up by the D1 reconciliation sweep. This also subsumes B1 if you would rather do one change than two — but do B1 first, because it proves the validation logic against a smaller blast radius.

**Rejected alternative:** an `Idempotency-Key` header is stricter but requires a frontend contract change, and `bid` already provides a natural per-review key.

## B5 · `dob` vs `age` cross-check

**Severity:** P2 · **Recommendation: APPROVE, log-only first**

Every traveller supplies both `dob` and `age`, and they are never compared. Pricing is driven by `age` at Search/Review; the policy is issued on `dob`. **A traveller reviewed at age 30 and booked with a 70-year-old's `dob` is the mispricing vector** — and unlike B2/B3 it needs no stored context, because both values are in the same payload.

Needs a **±1 year tolerance**: birthday boundaries and age computed at trip start versus today both produce legitimate off-by-one values.

**Why approval is needed:** doc p. 29 says passport and date formats are validated upstream but says nothing about age/dob cross-validation, so TripJack may accept a mismatch today. Rejecting locally could therefore break a request that currently succeeds. Shipping log-only first gives you the true mismatch rate at zero risk; switch to rejection once the logs are clean.

---

# §C — Security

## C1 · `B2C_PORTAL` authentication bypass

**Severity:** **P0 — the highest open risk in this service** · **Recommendation: APPROVE and schedule now**

`src/middlewares/auth.middleware.ts:19`:
```ts
if (req.body?.source === "B2C_PORTAL" || req.query?.source === "B2C_PORTAL") {
    return next();
}
```

`source` is attacker-controlled in **both the body and the query string**. Any caller who appends `?source=B2C_PORTAL` skips JWT verification entirely on:

| Endpoint | Consequence of the bypass |
|---|---|
| `POST /book` | **Book insurance with no token** — spends against the wallet / credit line |
| `POST /amendment/raise` | Raise a cancellation on any booking id |
| `POST /amendment/cancel` | **Cancel someone else's policy** — irreversible per doc p. 58 |
| `POST /booking-details` | Read any booking's details by id |
| `GET /bookings`, `GET /bookings/:id` | Mitigated in round 1 (`54b9ab6`) — now 401 instead of returning everyone's data |

**This also caps what the round-1 fix could achieve.** `book.controller.ts:7` assigns `agentId = "guest_user"` to every B2C booking, so all B2C bookings share one owner key. Per-customer isolation for B2C is **impossible** until this is resolved — the scoping fix removed the unauthenticated bulk read, it did not make the B2C flow multi-tenant safe.

**What a fix requires:** real tokens for B2C users (short-lived, issued by auth-service), or a signed service-to-service credential from the B2C portal. Either is a frontend/auth contract change, which is why it was deferred in both rounds rather than patched.

**Interim mitigation if a full fix cannot be scheduled:** restrict the bypass to `POST /search` and `POST /review` only — the two read-only quote endpoints — and require a token for everything that spends money or mutates a policy. Smaller change, removes the unauthenticated booking and cancellation paths.

## C2 · `/search` and `/review` are unauthenticated

**Severity:** P2 · **Recommendation: decide together with C1**

`src/routes/index.ts:42,45` mount `/search` and `/review` with no `authenticateJWT`. Every other route is protected. This is plausibly deliberate (public quote flow), but it means unmetered access to a **40 RPM** upstream — see D3. Confirm it is intentional; if so, D3 becomes more important, not less.

## C3 · `JWT_SECRET` hardcoded fallback

**Severity:** P2 · **Recommendation: APPROVE fail-fast**

`src/config/env.ts:8`:
```ts
jwtSecret: process.env.JWT_SECRET || "your_super_secret_jwt_key_change_me_in_production",
```

If `JWT_SECRET` is ever unset or misspelled in production, the service verifies tokens against a literal that is published in the repository — anyone can mint a valid token. It fails silently rather than loudly.

**Proposed:** refuse to start when `JWT_SECRET` is unset and `NODE_ENV=production`. Approval needed because it turns a silent misconfiguration into a startup failure — which is the point, but it will take the service down if the variable is currently missing. **Verify the production environment first.**

## C4 · TripJack error mapping

**Severity:** P2 · **Recommendation: DEFER** (deferred in both rounds by instruction)

`normaliseError` in `tripjack.insurance.provider.ts` throws a plain object with **no `message` property**. Controllers do `error.message || "Booking failed"`, so callers always receive the generic fallback text; the real TripJack message survives only inside `details`. Related: `provider.book()` computes a `msg` variable from the upstream error and never uses it (E5) — the lost message is right there.

Redesigning this changes the error contract for every client. Keep deferred unless the support burden justifies it.

---

# §D — Reliability

## D1 · Booking status polling does not survive a restart

**Severity:** P1 · **Recommendation: APPROVE**

`pollInsuranceStatus` in `book.service.ts` is in-process `setTimeout` recursion with a 2-minute deadline. It does not survive a process restart, a PM2 reload or a deploy. With multiple instances, every instance polls the same booking. On timeout the row stays `PENDING` for ever with nothing to retry it — **bookings that settle late at TripJack are permanently mislabelled locally.**

**Proposed, no new dependency:** a periodic reconciliation sweep — `setInterval`, or the existing unused `CRON_ENABLED` flag — querying `{ status: PENDING, createdAt: { $lt: now - 2min } }` and re-checking each via Booking Details. Idempotent, restart-safe, and it subsumes the in-process poller entirely.

**Confirm first:** how many instances run in production. A distributed lock is only warranted if more than one does.

```text
API change: none    DB change: none    Rollback: revert one commit
```

## D2 · Mongo connection failure does not stop startup

**Severity:** P2 · **Recommendation: APPROVE**

`src/server.ts` catches a failed `mongoose.connect` and starts the HTTP listener anyway. Every subsequent booking then succeeds upstream and fails to persist — the F-07 orphan path, for every single booking, until someone notices the log.

**Proposed:** exit non-zero when `MONGODB_URI` is set and the connection fails, so PM2 restarts rather than serving in a state where money moves and nothing is recorded. Approval needed because it converts a degraded-but-up service into a restart loop if Mongo is genuinely down.

## D3 · Rate limiting is not mounted

**Severity:** P2 · **Recommendation: APPROVE**

`express-rate-limit` is a declared dependency and is mounted **nowhere** (`grep` across `src/` returns nothing). TripJack's SLA caps at **40 RPM** (doc p. 87) and breaching it is our contractual problem. `/search` and `/review` are unauthenticated (C2), so there is currently no ceiling on how fast anyone can drive our upstream quota.

Needs a decision on **limit, scope (per-IP or per-agent), and response code** before implementation — it is a behaviour change for callers, adding 429.

## D4 · `coverageStart` / `coverageEnd` are never populated

**Severity:** P2 · **Blocked on evidence, not on approval**

`book.service.ts` reads `payload.sd` / `payload.ed`, but the Book contract carries **no** `sd`/`ed` — verified against doc pp. 24–25 and the Postman collection. Both schema fields have therefore been `undefined` on every booking record ever written.

The values could be backfilled from the booking-details response already fetched during polling, but that response's `isq` echo path is not evidenced in the doc (p. 40 says only *"isq & iti are again repeated and can be ignored"*) or in Postman. **Capture one real Booking Details response, confirm the path, then fix.** Alternatively this falls out of B1 for free, since the review context stores `sd`/`ed`.

## D5 · No `unhandledRejection` / `uncaughtException` handler

**Severity:** P3 · **Recommendation: APPROVE**

A rejected promise outside the existing `.catch` chains terminates the process under current Node defaults, with no log line identifying the cause. A handler that logs and exits cleanly costs four lines.

---

# §E — Low-risk, batch-approvable

| ID | Item | Detail | Risk of fixing |
|---|---|---|---|
| **E1** | Multiple products per plan (`pi.length > 1`) not rejected | Doc p. 21 implies one `pid` per `plid` — *"we choose the pid corresponding to plid"* — but does not state it as flatly as the one-plan rule that was enforced in round 2 (`40722f0`). Not enforced on that evidence alone | Low, but could reject a working request if TripJack does accept multi-product reviews. Confirm with A3 |
| **E2** | Duplicate traveller `id` not rejected | Amendment/cancellation `travellerKeys` are keyed by traveller `id`. Two travellers sharing `id: 1` make partial cancellation **target the wrong passenger**. Note `id` is not a documented mandatory field, so only *duplicates* should be rejected, never absence | **None** — a duplicate `id` cannot be a correct payload. Classified SAFE TO IMPLEMENT |
| **E3** | `deliveryInfo` not validated | Mandatory upstream (doc p. 25); the service forwards a payload without it and lets TripJack reject | Low — only changes where the rejection comes from |
| **E4** | `source` field never populated | `InsuranceBooking.source` exists in the schema and is never written. B2C and B2B bookings are indistinguishable in the database | None — additive write to an existing optional field |
| **E5** | Dead `msg` variable | `provider.book()` computes the upstream error message and discards it. See C4 — this is the lost message | None. Left alone in both rounds as an unrelated drive-by |
| **E6** | Duplicate index declaration | `InsuranceBooking.model.ts:136` declares both `unique: true` and `index: true` on `bookingId`, producing a Mongoose duplicate-index warning | None, cosmetic |

---

# §F — Scheduled separately

## F1 · Full UAT / documentation test matrix

**Severity:** P2 · Deferred by instruction in both rounds.

Doc pp. 89–93 define a certification matrix — 5 search-flow test cases plus Standalone/Student/AMT/Embedded book scenarios — that TripJack requires as JSON request/response pairs with confirmation numbers before certifying the integration.

The branch now carries **33 automated tests** covering the changed behaviour and the pre-existing validation rules. That is regression protection, **not certification**. The UAT matrix requires live UAT credentials and real confirmation numbers, so it is a separate exercise from this branch.

---

# What is already fixed — for contrast

Nothing in this document has been implemented. These **have** been, across both rounds, and need no decision:

| Commit | Fix |
|---|---|
| `78a376f` | Production TripJack API key resolved from `TRIPJACK_PROD_API_KEY` as well — the apikey header was going out empty |
| `f09131d` | Bearer tokens no longer written to application logs |
| `9c2fabb` | Traveller PII redacted from all TripJack request and error logs |
| `54b9ab6` | Booking reads scoped to the caller — `GET /bookings` no longer returns every customer's data |
| `53c4dba` | Payment amount validated; journey type classified correctly; lost DB writes surfaced as `ORPHANED_BOOKING` |
| `cc64502` | 27 regression tests, Node built-in runner, no new dependencies |
| `40722f0` | Exactly one plan enforced through Review and Book (+6 tests) |

---

## What is left after round 3

1. **Send A1 and A3 to TripJack.** Neither blocks the release now — B4 refuses duplicate bookings locally regardless of the answer to A1 — but both close out residual uncertainty for free.
2. **C1 remains the largest open risk in the service.** Unauthenticated booking and cancellation via an attacker-controlled `source` field, kept as-is by decision. Everything else in this branch is defence around it, not a substitute for it.
3. **Verify the production environment before deploying:** `JWT_SECRET` set, `MONGODB_URI` reachable, and the TripJack API key present under either accepted name. The service now refuses to start without the first two.
4. **F1 (UAT certification matrix)** still needs live credentials and real confirmation numbers. The 59 automated tests are regression protection, not certification.
