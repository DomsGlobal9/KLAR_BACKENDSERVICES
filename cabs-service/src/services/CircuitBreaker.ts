import { StructuredError } from "./StructuredError";

/**
 * Simple circuit breaker used to shield the service from a flapping/​down
 * TripJack upstream. After `failureThreshold` consecutive failures the circuit
 * OPENs and fast-fails for `resetTimeoutMs`, then HALF_OPENs to probe recovery.
 *
 * Ported from hotel-booking-service so cabs gets the same upstream resilience.
 */
export class CircuitBreaker {
  private failureThreshold: number;
  private resetTimeoutMs: number;

  private failureCount: number = 0;
  private lastFailureTime: number | null = null;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(failureThreshold: number = 5, resetTimeoutMs: number = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
      } else {
        throw new StructuredError(
          "CIRCUIT_BREAKER_OPEN",
          "The cabs supplier is currently unavailable. Please try again in a moment.",
        );
      }
    }

    try {
      const result = await task();
      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failureCount = 0;
        console.log("[CircuitBreaker] Supplier stabilized. Circuit CLOSED.");
      }
      return result;
    } catch (error: any) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold && this.state !== "OPEN") {
      console.error(
        `[CircuitBreaker] Threshold reached (${this.failureCount}). Circuit OPENED!`,
      );
      this.state = "OPEN";
    }
  }
}
