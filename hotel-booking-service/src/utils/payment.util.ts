import axios from "axios";
import { env } from "../config/env";

/**
 * Client for payment-service. Used to return money to B2C/GUEST customers, who
 * paid through Razorpay rather than an agent wallet.
 */
export class PaymentUtil {
  /**
   * Refund a captured Razorpay payment.
   *
   * Throws on any failure so the caller never records a refund that did not
   * happen. Razorpay does not deduplicate refunds, so callers must claim the
   * refund on their own record before calling this.
   *
   * @returns the Razorpay refund id, for the audit trail.
   */
  static async refundGatewayPayment(
    razorpayPaymentId: string,
    amount: number,
    referenceId: string,
    description: string,
    platform: "B2B" | "B2C" = "B2C",
  ): Promise<string> {
    if (!env.internalServiceKey) {
      throw new Error(
        "INTERNAL_SERVICE_KEY is not configured; cannot issue a gateway refund.",
      );
    }

    console.log(
      `[PaymentUtil] Refunding ₹${amount} on payment ${razorpayPaymentId} for ref: ${referenceId}`,
    );

    const response = await axios.post(
      `${env.paymentServiceUrl}/razorpay/internal/refund`,
      {
        paymentId: razorpayPaymentId,
        amount,
        platform,
        notes: { referenceId, description, service: "hotel-booking-service" },
      },
      { headers: { "x-internal-key": env.internalServiceKey } },
    );

    if (!response.data?.success) {
      throw new Error(
        response.data?.message || "Gateway refund was rejected by payment-service",
      );
    }

    return response.data?.data?.id || "";
  }
}
