import mongoose from "mongoose";
import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import { InsuranceBookingModel, InsuranceBookingStatus } from "../models/InsuranceBooking.model";

/**
 * Booking status reconciliation (D1).
 *
 * Replaces the in-process setTimeout poller, which died with the process: a
 * restart, PM2 reload or deploy left bookings PENDING for ever, and with more
 * than one instance every instance polled the same booking.
 *
 * This sweep is stateless and idempotent — it re-derives work from the database
 * on every tick, so it survives restarts and picks up bookings abandoned by a
 * previous process.
 *
 * ponytail: no distributed lock. With multiple instances each will poll the same
 * booking — wasteful but harmless, since every write is an idempotent status
 * set. Add a lease field if the upstream call volume becomes a problem.
 */

const SWEEP_INTERVAL_MS = 60_000;   // how often to look for unsettled bookings
const MIN_AGE_MS        = 30_000;   // give the booking a moment to settle first
const MAX_AGE_MS        = 86_400_000; // stop chasing after 24h
const BATCH_SIZE        = 50;

const TJ_SUCCESS   = new Set(["SUCCESS"]);
const TJ_CANCELLED = new Set(["CANCELLED"]);
const TJ_FAILED    = new Set(["FAILED", "ABORTED"]);

/** Terminal status for a TripJack booking status, or null if still in flight. */
export function mapUpstreamStatus(upstream: string): InsuranceBookingStatus | null {
    if (TJ_SUCCESS.has(upstream))   return InsuranceBookingStatus.SUCCESS;
    // The previous poller recorded CANCELLED bookings as FAILED, which is what
    // the amendment flow already distinguishes. Record it accurately.
    if (TJ_CANCELLED.has(upstream)) return InsuranceBookingStatus.CANCELLED;
    if (TJ_FAILED.has(upstream))    return InsuranceBookingStatus.FAILED;
    return null;
}

/** One reconciliation pass. Returns the number of bookings moved to a terminal status. */
export async function reconcilePendingBookings(): Promise<number> {
    const now = Date.now();
    const pending = await InsuranceBookingModel.find({
        status: InsuranceBookingStatus.PENDING,
        createdAt: { $lt: new Date(now - MIN_AGE_MS), $gt: new Date(now - MAX_AGE_MS) },
    })
        .limit(BATCH_SIZE)
        .lean();

    let settled = 0;
    for (const booking of pending) {
        try {
            const details = await tripJackInsuranceProvider.bookingDetails(booking.bookingId);
            const upstream: string =
                details?.order?.status ||
                details?.itemInfos?.INSURANCE?.ios ||
                "";

            const status = mapUpstreamStatus(upstream);
            if (!status) continue;

            await InsuranceBookingModel.findByIdAndUpdate(booking._id, {
                status,
                tjBookingDetailsResponse: details,
                ...(status === InsuranceBookingStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
            });
            settled++;
            console.log(`[TripSafe][reconcile] ${booking.bookingId} → ${status}`);
        } catch (err: any) {
            // Leave it PENDING; the next sweep retries.
            console.error(`[TripSafe][reconcile] ${booking.bookingId} failed: ${err?.message}`);
        }
    }
    return settled;
}

let timer: NodeJS.Timeout | null = null;

/** Start the periodic sweep. No-op if already running or explicitly disabled. */
export function startReconciliation(): void {
    if (timer) return;
    if (process.env.RECONCILE_ENABLED === "false") {
        console.log("[TripSafe][reconcile] disabled via RECONCILE_ENABLED=false");
        return;
    }

    timer = setInterval(() => {
        if (mongoose.connection.readyState !== 1) return;
        reconcilePendingBookings().catch(err =>
            console.error("[TripSafe][reconcile] sweep failed:", err?.message)
        );
    }, SWEEP_INTERVAL_MS);

    // Do not hold the event loop open on shutdown.
    timer.unref?.();
    console.log(`[TripSafe][reconcile] sweeping every ${SWEEP_INTERVAL_MS / 1000}s`);
}

/** Stop the sweep (tests / graceful shutdown). */
export function stopReconciliation(): void {
    if (timer) clearInterval(timer);
    timer = null;
}
