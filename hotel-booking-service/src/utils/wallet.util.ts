import axios from "axios";
import { env } from "../config/env";

export interface MarkupRule {
  serviceType: string;
  percentageMarkup: number;
  fixedMarkup: number;
}

export class WalletUtil {
  /**
   * Checks if the agent has sufficient internal balance in Klar.
   */
  static async checkInternalBalance(
    token: string,
    requiredAmount: number,
  ): Promise<{ hasBalance: boolean; balance: number }> {
    try {
      const response = await axios.get(`${env.authServiceUrl}/user/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data && response.data.success) {
        const balance = response.data.data.balance;
        return { hasBalance: balance >= requiredAmount, balance };
      }
      throw new Error("Failed to fetch internal wallet balance");
    } catch (error: any) {
      console.error("[WalletUtil] Error checking balance:", error.message);
      throw new Error(
        error.response?.data?.message || "Internal wallet service unavailable",
      );
    }
  }

  /**
   * Deducts balance from the agent's wallet for a booking.
   */
  static async deductBalance(
    token: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<boolean> {
    try {
      console.log(`[WalletUtil] Deducting ₹${amount} for ref: ${referenceId}`);
      const response = await axios.post(
        `${env.authServiceUrl}/user/wallet/debit`,
        {
          amount,
          referenceType: "HOTEL_BOOKING",
          referenceId,
          description,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return response.data && response.data.success;
    } catch (error: any) {
      const isNetworkError =
        error.code === "ECONNREFUSED" ||
        error.code === "ENOTFOUND" ||
        error.code === "ECONNRESET";
      const authMessage = error.response?.data?.message;
      const errorMessage = isNetworkError
        ? `Auth service is unreachable (${env.authServiceUrl}). Ensure auth-service is running.`
        : authMessage || "Wallet deduction failed";
      console.error(
        "[WalletUtil] Error deducting balance:",
        error.response?.data || error.message,
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Refunds balance to the agent's wallet in case of failure.
   */
  static async refundBalance(
    token: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<boolean> {
    try {
      console.log(`[WalletUtil] Refunding ₹${amount} for ref: ${referenceId}`);
      const response = await axios.post(
        `${env.authServiceUrl}/user/wallet/credit`,
        {
          amount,
          type: "REFUND",
          paymentMethod: "WALLET",
          referenceType: "HOTEL_BOOKING_REFUND",
          referenceId,
          description,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return response.data && response.data.success;
    } catch (error: any) {
      console.error(
        "[WalletUtil] Error refunding balance:",
        error.response?.data || error.message,
      );
      return false;
    }
  }

  /**
   * Credit an agent's wallet from a background job.
   *
   * `refundBalance` credits whoever owns the JWT it is given, which is correct
   * inside a request but useless to a cron: the worker must credit the agent
   * who owns the stuck booking. This hits the shared-secret internal route,
   * which takes the target userId explicitly.
   *
   * Throws on failure so callers never record a refund that did not happen.
   */
  static async refundToAgentWallet(
    agentUserId: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<void> {
    if (!env.internalServiceKey) {
      throw new Error(
        "INTERNAL_SERVICE_KEY is not configured; cannot issue a wallet refund.",
      );
    }

    const response = await axios.post(
      `${env.authServiceUrl}/user/wallet/internal/credit`,
      {
        userId: agentUserId,
        amount,
        type: "REFUND",
        paymentMethod: "WALLET",
        referenceType: "HOTEL_BOOKING_REFUND",
        referenceId,
        description,
      },
      { headers: { "x-internal-key": env.internalServiceKey } },
    );

    if (!response.data?.success) {
      throw new Error(
        response.data?.message || "Wallet refund was rejected by auth-service",
      );
    }
  }

  /**
   * Fetches the markup rules for the agent.
   */
  static async getMarkupRules(token: string): Promise<MarkupRule[]> {
    try {
      const response = await axios.get(
        `${env.authServiceUrl}/user/markup/my-markup`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data && response.data.success) {
        // Ensure we handle both array and services object structure
        return Array.isArray(response.data.data)
          ? response.data.data
          : response.data.data.services || [];
      }
      return [];
    } catch (error: any) {
      console.error("[WalletUtil] Error fetching markup:", error.message);
      return [];
    }
  }
}
