import axios from "axios";
import { env } from "../config/env";

/**
 * Client for payment-service. Used to return money to B2C/GUEST customers, who
 * paid through Razorpay rather than an agent wallet.
 */
export class PaymentUtil {
  /**
   * Verify a Razorpay payment SERVER-SIDE before a B2C/GUEST booking is trusted.
   *
   * The browser cannot be trusted to tell us a payment happened: it supplies a
   * razorpayPaymentId, and this confirms with payment-service (which holds the
   * Razorpay secret) that the payment is genuinely captured, belongs to the
   * given order, and covers `expectedAmount`.
   *
   * Fails CLOSED: any error, missing config, or missing id returns
   * { verified: false } so the caller rejects the booking rather than gifting it.
   */
  static async verifyRazorpayPayment(params: {
    paymentId?: string;
    orderId?: string;
    expectedAmount: number;
    platform?: "B2B" | "B2C";
  }): Promise<{ verified: boolean; reason?: string; capturedAmount: number }> {
    const { paymentId, orderId, expectedAmount, platform = "B2C" } = params;

    if (!env.internalServiceKey) {
      return {
        verified: false,
        reason:
          "INTERNAL_SERVICE_KEY is not configured; cannot verify payment.",
        capturedAmount: 0,
      };
    }
    if (!paymentId) {
      return {
        verified: false,
        reason: "Missing razorpayPaymentId.",
        capturedAmount: 0,
      };
    }

    try {
      const response = await axios.post(
        `${env.paymentServiceUrl}/razorpay/internal/verify`,
        { paymentId, orderId, expectedAmount, platform },
        {
          headers: { "x-internal-key": env.internalServiceKey },
          timeout: 15000,
        },
      );

      const data = response.data?.data;
      if (!response.data?.success || !data) {
        return {
          verified: false,
          reason: response.data?.message || "Payment verification failed.",
          capturedAmount: 0,
        };
      }

      return {
        verified: !!data.verified,
        reason: data.reason,
        capturedAmount: Number(data.capturedAmount) || 0,
      };
    } catch (err: any) {
      return {
        verified: false,
        reason:
          err?.response?.data?.message ||
          err?.message ||
          "Payment verification request failed.",
        capturedAmount: 0,
      };
    }
  }

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
        response.data?.message ||
          "Gateway refund was rejected by payment-service",
      );
    }

    return response.data?.data?.id || "";
  }
}
