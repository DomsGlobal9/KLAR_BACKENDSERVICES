# TripSafe Insurance Service — Audit & Delivery Report

**Scope:** `insurance-service/` only. **Branch:** `audit/tripsafe-insurance-hardening`
**Base commit:** `aac5b43` · **Sources of truth:** TripSafe API Documentation v6.0, TripSafe Coverage Sheet, `postman/TripSafe-Insurance-Service.postman_collection.json`, current implementation.

---

## Executive Summary

Audited every file in `insurance-service/` end to end: routes → middleware → controllers → services → provider → TripJack client → MongoDB, against the TripSafe v6.0 contract.

**22 findings. 7 implemented, 15 recorded.** The implemented set is confined to defects where the current behaviour is provably wrong against the contract or leaks data, and where the fix cannot reject a request that legitimately succeeds today. Two were production-stopping: the upstream API key was resolved from an environment variable name that no deployed `.env` defines, and the booking read endpoints returned every customer's booking with full PII to an unauthenticated caller.

Nothing was refactored for style. The production URL, the `B2C_PORTAL` authentication bypass and the TripJack error mapping are untouched per instruction, and are **not** represented as fixed.

**Release risk: MEDIUM.** One intentional, pre-approved behaviour change (booking-read scoping). Everything else is additive or strictly internal.

---

## Baseline

```text
Commit:        aac5b43
Branch:        issue/insurance → audit/tripsafe-insurance-hardening
Working tree:  CLEAN
Node / npm:    v24.13.1 / 11.8.0
Build:         PASS  (tsc, 0 errors)
TypeScript:    PASS  (strict: true)
Tests:         NOT AVAILABLE — no test script, no test framework, zero test files
Lint:          NOT AVAILABLE — no linter configured
```

The baseline had no automated verification of any kind. `npm test` and `npm run typecheck` now exist and are the only scripts added; no existing script was modified.

---

## Findings

| ID | Area | Severity | Finding | Action | Status |
|---|---|---|---|---|---|
| F-01 | Config | **P0** | Production TripJack API key resolved only from `TRIPJACK_API_KEY`; deployed `.env` defines `TRIPJACK_PROD_API_KEY`. `apikey` header sent empty → every upstream call fails | Additive env alias | **FIXED** |
| F-02 | Security | P1 | Full `Authorization` header and JWT prefix written to logs on every request | Statements removed | **FIXED** |
| F-03 | Security / PII | P1 | Search/Review/Book/Amendment logged full payloads: DOB, passport, email, mobile, pincode, gender, nominee, student sponsor | `redactForLog()` at all sites | **FIXED** |
| F-04 | Security / Data | **P0** | `GET /bookings` and `GET /bookings/:id` unscoped — `?source=B2C_PORTAL` returns *every* booking with full PII to an unauthenticated caller | Scoped to caller; 401 / 404 | **FIXED** (approved) |
| F-05 | Data quality | P2 | `detectJourneyType` read `ict`, absent from the Book contract → every Student/AMT booking stored as `STANDALONE` | Fallback to product id | **FIXED** |
| F-06 | Payment | P1 | `paymentInfos[0].amount` never validated; zero/negative/non-numeric forwarded upstream and persisted as `0` | Reject non-positive | **FIXED** |
| F-07 | Data integrity | P1 | DB failure after a successful upstream booking swallowed; caller told success for a booking with no local record | `persisted` flag + `ORPHANED_BOOKING` log | **FIXED** |
| D-01 | Config | P2 | Doc §2 states prod domain `https://tripjack.com`; code uses `https://api.tripjack.com`; `.env` sets `TRIPJACK_PROD_BASE_URL=https://tripjack.com` which `env.ts` never reads | Deferred §1.1 | **DEFERRED** |
| D-02 | Auth | **P0** | `source=B2C_PORTAL` in body **or query** skips JWT entirely on `/book`, `/booking-details`, `/bookings`, `/amendment/*` — anyone can book and cancel unauthenticated | Deferred §1.2 | **DEFERRED** |
| D-03 | Errors | P2 | `normaliseError` throws an object with no `message`; controllers therefore always emit the generic fallback and the real TripJack message survives only in `details` | Deferred §1.3 | **DEFERRED** |
| D-04 | QA | P2 | Full UAT/contract matrix (doc pp. 89–93) not built | Deferred §1.4 | **DEFERRED** |
| F-08 | Contract | P1 | No Review context persisted → Book's `plid`/`pid`/traveller count/amount cannot be checked against what was reviewed. Client fully trusted | Proposal below | **RECORDED** |
| F-09 | Reliability | P1 | Status polling is in-process `setTimeout` recursion — does not survive restart, PM2 reload or deploy; multiple instances poll the same booking | Proposal below | **RECORDED** |
| F-10 | Data integrity | P1 | No idempotency on `/book`; a retried request books upstream twice. The second DB write fails on the `bookingId` unique index and (pre-F-07) was silent | Needs approval | **RECORDED** |
| F-11 | Contract | P2 | Documentation self-conflicts — see *Source conflicts* below | Needs decision | **RECORDED** |
| F-12 | Payment | P2 | `paymentMedium` not whitelisted and split payments not rejected, though doc says only `WALLET`/`CREDIT_LINE`, single entry | Deliberately not done | **RECORDED** |
| F-13 | Auth | P2 | `/search` and `/review` are entirely unauthenticated | Needs decision | **RECORDED** |
| F-14 | Reliability | P2 | `express-rate-limit` is a dependency but mounted nowhere; TripJack SLA caps at **40 RPM** and breaching it is our problem | Needs approval | **RECORDED** |
| F-15 | Reliability | P2 | Mongo connection failure is caught and the server starts anyway — every booking then takes the F-07 orphan path | Needs approval | **RECORDED** |
| F-16 | Security | P2 | `env.jwtSecret` falls back to a hardcoded literal; if `JWT_SECRET` is unset in prod, tokens verify against a value published in the repo | Needs approval (fail-fast) | **RECORDED** |
| F-17 | Contract | P2 | Amendment ≥24h-before-coverage rule (doc p. 51) not enforced locally | Needs approval | **RECORDED** |
| F-18 | Contract | P2 | `deliveryInfo` is mandatory upstream but never validated | Needs approval | **RECORDED** |
| F-19 | Code | P3 | `provider.book()` computes `msg` and never uses it — a lost error message | Not touched (drive-by) | **RECORDED** |
| F-20 | Code | P3 | `InsuranceBooking.source` is in the schema but never populated | Needs decision | **RECORDED** |
| F-21 | Code | P3 | `bookingId` declares both `unique: true` and `index: true` — duplicate index definition | Cosmetic | **RECORDED** |
| F-22 | Reliability | P3 | No `unhandledRejection` / `uncaughtException` handler | Needs approval | **RECORDED** |

---

## Implemented Changes

### F-01 — Production API key never resolved
```text
Files:   src/config/env.ts
Change:  API_KEY: process.env.TRIPJACK_API_KEY || process.env.TRIPJACK_PROD_API_KEY || ""
Reason:  env.ts read TRIPJACK_API_KEY / TRIPJACK_BASE_URL. The .env in the repo defines
         TRIPJACK_PROD_API_KEY and TRIPJACK_PROD_BASE_URL and has the former pair commented
         out. Neither name overlaps, so the axios client sent `apikey: ""` and every TripSafe
         call failed authentication. The TEST branch has the same shape: TRIPJACK_TEST_API_KEY
         is not defined in this .env either, so local/dev runs are also unauthenticated.
Risk:    None. Strictly additive — TRIPJACK_API_KEY still takes precedence, so any environment
         that works today is byte-identical. BASE_URL resolution deliberately untouched (D-01).
Test:    Not unit-tested (environment resolution). Verify by asserting a non-empty apikey
         header against UAT before promoting.
Commit:  78a376f
Action:  set TRIPJACK_TEST_API_KEY for non-production deployments — this fix does not
         cross-wire the production key onto apitest.tripjack.com, and must not.
```

### F-02 — Bearer tokens in application logs
```text
Files:   src/middlewares/auth.middleware.ts
Change:  Removed the raw Authorization header log and the JWT-prefix log.
Reason:  Every authenticated request wrote a replayable live token to stdout and log storage.
Risk:    None. Two log statements deleted; parsing, verification, the B2C bypass and every
         response path are untouched.
Commit:  f09131d
```

### F-03 — Traveller PII in logs
```text
Files:   src/providers/tripjack.insurance.provider.ts
Change:  Added redactForLog(); applied to all five request logs and the upstream error log.
Reason:  Book and embedded Review payloads carry DOB, passport number, email, mobile,
         pincode, gender, nominee and the student sponsor block. All were logged in clear.
Risk:    None to behaviour — outbound payloads to TripJack are unchanged, only the log
         rendering differs. Plan/product/booking ids and amounts stay greppable for support.
Test:    2 tests assert every identity value is absent and every operational id is present.
Commit:  9c2fabb
```

### F-04 — Unscoped booking reads *(intentional behaviour change, approved)*
```text
Files:   src/services/list.service.ts, src/services/bookingDetails.service.ts,
         src/controllers/list.controller.ts, src/controllers/bookingDetails.controller.ts
Change:  Both reads require a caller identity and filter on agentId/userId.
         No identity → 401. Not the caller's booking → 404 (existence not disclosed).
         list.controller now propagates the thrown status instead of forcing 500.
Reason:  list.service applied the agent filter only `if (query.agentId)`, and getFromDb applied
         no ownership filter at all. Combined with the B2C_PORTAL bypass (D-02), an
         unauthenticated GET /api/insurance/bookings?source=B2C_PORTAL returned the entire
         collection — every customer's DOB, passport number, email, mobile and nominee.
Risk:    MEDIUM — the one behaviour change in this release. A caller relying on the unscoped
         list now gets 401. That contract was leaking third-party PII and cannot be valid.
Test:    2 tests assert 401 rather than an unscoped result set, for both id forms.
Commit:  54b9ab6
```
> **Residual risk, not closed by this fix:** `book.controller` assigns `agentId = "guest_user"`
> to every B2C booking. Scoping is therefore only as fine-grained as the identity we are given —
> all B2C bookings share one owner key. Per-customer isolation for B2C is impossible until
> **D-02** is resolved. This fix removes the unauthenticated bulk read; it does not make the
> B2C flow multi-tenant safe.

### F-05 / F-06 / F-07 — Book service
```text
Files:   src/services/book.service.ts
Commit:  53c4dba

F-06  paymentInfos[0].amount is now required to be a finite number > 0, checked before the
      upstream call. Previously any value — including undefined — was forwarded to TripJack
      and persisted via `amount: ... || 0`, corrupting the record and any revenue reporting
      built on it. Scope limited to the amount by decision; medium/count remain F-12.
      Risk: LOW. A non-positive amount cannot be a purchase that succeeds today.

F-05  detectJourneyType read only `ict`, which the Book contract does not carry, so every
      Student and AMT booking was stored as STANDALONE. It now falls back to the plan family
      in the product id (…PLAN_250_STUDENT…, …_ANNUAL…). Classification is used for
      persistence only: the `sc` requirement stays keyed to an explicitly declared Student
      journey, so no request accepted today becomes rejected.
      Risk: NONE to request handling. Newly written rows carry a correct journeyType;
      rows written before this change keep the old STANDALONE label — backfill separately
      if reporting depends on it.

F-07  A DB failure after a successful upstream booking was logged as a warning and swallowed.
      The response now carries `persisted: boolean` (additive) and the failure emits
      🚨 [TripSafe][ORPHANED_BOOKING] with bookingId, amount and agentId for reconciliation.
      Risk: NONE. Additive response field; no status code or existing field changed.

Test:  8 tests — 4 amount rejections (asserting TripJack is never called), 1 success path
       asserting bookingId and persisted, 3 classification/traveller-rule tests.
```

---

## Deliberately Deferred — **not fixed, do not report as fixed**

1. **Production URL (D-01)** — `api.tripjack.com` retained. Doc v6.0 §2 says `https://tripjack.com`, and the repo `.env` sets `TRIPJACK_PROD_BASE_URL` to that value while `env.ts` reads a different variable. Left alone per §1.1. Confirm the correct prod domain with TripJack before touching this; changing it and the key alias in the same release would make a failure impossible to attribute.
2. **B2C authentication bypass (D-02)** — unchanged per §1.2. Recorded as the largest open security risk: `source` is attacker-controlled in both body and query, so `/book` and `/amendment/*` are reachable with no token at all.
3. **TripJack error mapping (D-03)** — unchanged per §1.3.
4. **Full UAT / documentation test matrix (D-04)** — not attempted per §1.4. QA debt.

---

## Source conflicts (F-11) — resolve with TripJack, do not guess

| # | Source A | Source B | Current code | Impact |
|---|---|---|---|---|
| 1 | §4 p. 87: travellers **above 70** not permitted | Search FAQ p. 14: valid age range **0–75** | `0–75` | Tightening to 70 would reject searches that succeed today. **Left as-is.** |
| 2 | §4 p. 87: coverage **must not exceed 90 days** | Search matrix p. 89: Standalone **max 180 days** | `180` | Tightening to 90 would reject searches that succeed today. **Left as-is.** |
| 3 | p. 66: student `cd` = 30/60/90/180/360/730/1095; *Important Note* = 180/365/730/1095 | Search matrix p. 89: 30/60/90/120/180/240/270/365/**735** | 30/60/90/120/180/240/270/365/730/1095 | Code is a permissive superset (`730` not `735` — likely a doc typo). **Left as-is.** |
| 4 | p. 4 & p. 83: AMT covers **30/45/60/90** days | Matrix p. 89 + UAT §4.4: **30/45/60 only**, other durations must error | 30/45/60 | Code follows the stricter UAT rule. A legitimate 90-day AMT search would be rejected locally. **Confirm.** |

Each of these is a case where documentation contradicts itself and the implementation is the more permissive reading. No behaviour was changed on the strength of a conflicted source.

---

## Proposals (not implemented — require approval)

### F-08 · Review → Book consistency
Doc p. 23: *"All submitted data must exactly match the information provided in the Insurance Review Request."* Nothing from Review is persisted, so the service cannot enforce that; `plid`, `pid`, traveller count, ages and the payment amount are whatever the client sends. TripJack validates upstream, so this is a defence-in-depth and mis-billing gap rather than a live exploit — but the amount the customer is charged is currently client-declared.

Smallest production-safe design:
1. In `review.service`, on a successful Review, persist one document keyed by the returned `bid`: `{ bid, plid, pid, travellerCount, ages[], sd, ed, totalFare, createdAt }` with a TTL index (upstream states reviewed plans do not currently expire — a 24 h TTL is a safe default).
2. In `book.service`, look up by `payload.bookingId`. If absent → proceed unchanged (fail-open, so nothing that works today breaks). If present → compare `plid`, `pid`, traveller count and amount; reject mismatches with 400.
3. Ship fail-open first, observe the mismatch counter in production, and only then decide whether to fail-closed.

Requires a new collection (schema approval per §10/§15). Roughly one service change plus one model; reversible by dropping the collection.

### F-09 · Booking status polling
`pollInsuranceStatus` is in-process `setTimeout` recursion with a 2-minute deadline. It does not survive process restart, PM2 reload or deploy; with multiple instances every instance polls the same booking; and on timeout the row stays `PENDING` forever with nothing to retry it. Bookings that settle late at TripJack are permanently mislabelled locally.

Minimum viable replacement, no new dependency: a periodic reconciliation sweep (`setInterval`, or the existing `CRON_ENABLED` flag) that queries `{ status: PENDING, createdAt: { $lt: now - 2min } }` and re-checks each via Booking Details. Idempotent, restart-safe, and it subsumes the in-process poller. A distributed lock or queue is only warranted if more than one instance runs — confirm the deployment topology first.

### F-10 · Booking idempotency
Add a unique constraint keyed on the Review `bookingId` (or a caller-supplied idempotency key) and short-circuit a repeat before the upstream call. Requires an index change → approval per §15.

### F-14 · Rate limiting
`express-rate-limit` is already installed and mounted nowhere. TripJack's SLA is **40 RPM**; exceeding it is our breach. Mounting a limiter is a behaviour change for callers, so it needs a decision on limit, scope (per-IP vs per-agent) and response code.

---

## Regression Results

```text
Build:              PASS   (tsc, 0 errors)
TypeScript:         PASS   (strict)
Unit tests:         PASS   27/27
Integration tests:  PASS   route→service→provider-mock coverage on search/review/book
Regression tests:   PASS   pre-existing search/review/traveller rules asserted unchanged
Negative tests:     PASS   19 of the 27 are rejection cases
Lint:               NOT AVAILABLE (no linter configured — pre-existing)
```

Test quality: TripJack is mocked at the provider boundary, never inside the logic under test. No live credentials. Rejection tests assert the upstream call count is zero, so a test cannot pass because the code never ran. Non-vacuity was verified by mutation — inverting the amount guard and disabling the redaction predicate in the compiled output fails 4 of the 27.

---

## API Compatibility

```text
Search:           UNCHANGED    request, response and upstream payload identical
Review:           UNCHANGED
Booking:          COMPATIBLE   additive `persisted` field; new 400 only for a
                               non-positive/absent payment amount, which cannot succeed today
Booking Details:  UNCHANGED    (POST /booking-details proxy)
Amendment:        UNCHANGED
Cancellation:     UNCHANGED
GET /bookings:        CHANGED  401 when the caller has no identity (was: everyone's bookings)
GET /bookings/:id:    CHANGED  404 when the caller does not own the booking (was: any booking)
```

The two `CHANGED` entries are F-04 and were explicitly approved.

## Database Compatibility

```text
Schema changed:      NO
Indexes changed:     NO
Migration required:  NO
Rollback required:   NO
```
Field *values* improve going forward (`journeyType` correct for Student/AMT, `amount` never `0`). Historical rows are untouched; backfill only if reporting depends on the old labels.

## Security

Fixed: bearer-token logging (F-02), PII logging (F-03), unauthenticated cross-customer booking reads (F-04).
Reported, not fixed: **D-02** `B2C_PORTAL` bypass (highest open risk — unauthenticated booking and cancellation), F-13 unauthenticated `/search` and `/review`, F-16 hardcoded `JWT_SECRET` fallback.
No authentication behaviour was modified. No secret is committed; `.env` is not tracked.

## Release Risk — **MEDIUM**

Six of seven changes are additive, internal, or remove a log line. The seventh (F-04) intentionally changes two read endpoints from "returns everything" to "returns yours", which is a breaking change for any caller depending on the old behaviour — and was approved on the basis that the old behaviour leaked third-party PII. F-01 changes nothing where `TRIPJACK_API_KEY` is already set and repairs the service where it is not.

## Rollback

```text
Rollback commit:              aac5b43 (branch point)
Procedure:                    git revert cc64502 53c4dba 54b9ab6 9c2fabb f09131d 78a376f
                              — or revert individually; each commit is one finding and is
                              independently reversible, none depends on another.
Database rollback required:   NO  — no schema or index change
Environment rollback required: NO — no variable renamed or removed, only an alias added
API compatibility risk:       Reverting 54b9ab6 restores the F-04 data leak
Estimated rollback impact:    Deploy-only, seconds. No data migration.
```

## Final CTO Recommendation — **APPROVE WITH CONDITIONS**

Conditions:
1. **Verify F-01 against UAT before production.** If the deployed production `.env` already sets `TRIPJACK_API_KEY`, this is a no-op; if it does not, this release is what makes the integration work at all. Confirm which, so the change is understood rather than assumed.
2. **Confirm no client depends on the unscoped `GET /bookings`.** If a B2C "my bookings" page uses `source=B2C_PORTAL`, it will start returning 401 and needs a real token — which is D-02.
3. **Schedule D-02.** Unauthenticated booking and cancellation via an attacker-controlled `source` field is the largest remaining risk in this service, and it caps how much F-04 can protect.
4. **Set `TRIPJACK_TEST_API_KEY`** in non-production environments.
5. Do not report D-01 through D-04 as fixed. They are not.
