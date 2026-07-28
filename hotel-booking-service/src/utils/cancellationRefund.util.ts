import { round2 } from "./pricing.util";

export type CancellationRefundResolution =
  | {
      ok: true;
      /** What the payer originally paid us (net + markup). */
      totalPaid: number;
      /** Supplier's cancellation penalty for this booking. */
      penalty: number;
      /** What we owe the payer back. */
      refundAmount: number;
    }
  | { ok: false; reason: string };

/**
 * Work out what a cancelled booking owes the traveller.
 *
 * Money policy — refund = what the payer paid − the supplier's penalty.
 * That means Klar hands back its own markup on a cancellation rather than
 * keeping it. Changing that is a commercial decision, not a code one: it lives
 * here, on one line, so it can be changed deliberately.
 *
 * Returns `ok: false` rather than a number whenever the inputs are not
 * trustworthy. A wrong refund is far more expensive than a delayed one:
 *
 *  - `applicableCharge` is null when TripJack gave us no cancellation policy.
 *    `totalPaid - null` silently evaluates to `totalPaid` in JS, which would
 *    refund the customer in full and leave Klar eating the penalty.
 *  - a penalty quoted in a different currency cannot be subtracted from an INR
 *    total.
 *  - a penalty larger than the amount paid means our understanding of the
 *    booking is wrong; refunding ₹0 might be right, but a human should confirm.
 */
export function resolveCancellationRefund(
  booking: any,
  cancelChargesInfo: any,
): CancellationRefundResolution {
  const totalPaid = Number(booking?.totalAmount);
  if (!Number.isFinite(totalPaid) || totalPaid <= 0) {
    return { ok: false, reason: "The booking has no positive totalAmount." };
  }

  if (!cancelChargesInfo) {
    return {
      ok: false,
      reason: "No cancellation charge breakdown was captured.",
    };
  }

  const rawPenalty = cancelChargesInfo.applicableCharge;
  if (rawPenalty === null || rawPenalty === undefined) {
    return {
      ok: false,
      reason:
        "The supplier returned no cancellation policy, so the penalty is unknown.",
    };
  }

  const penalty = Number(rawPenalty);
  if (!Number.isFinite(penalty) || penalty < 0) {
    return {
      ok: false,
      reason: `Penalty is not a valid amount: ${rawPenalty}`,
    };
  }

  const bookingCurrency = (booking.currencyCode || "INR").toUpperCase();
  const penaltyCurrency = (
    cancelChargesInfo.currency || bookingCurrency
  ).toUpperCase();
  if (penalty > 0 && penaltyCurrency !== bookingCurrency) {
    return {
      ok: false,
      reason: `Penalty is in ${penaltyCurrency} but the booking is in ${bookingCurrency}.`,
    };
  }

  if (penalty > totalPaid) {
    return {
      ok: false,
      reason: `Penalty (₹${penalty}) exceeds the amount paid (₹${totalPaid}).`,
    };
  }

  return {
    ok: true,
    totalPaid: round2(totalPaid),
    penalty: round2(penalty),
    refundAmount: round2(totalPaid - penalty),
  };
}
