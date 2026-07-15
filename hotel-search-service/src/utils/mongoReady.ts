import mongoose from "mongoose";

/**
 * True only when a live connection exists.
 *
 * Without this check mongoose *buffers* the operation and rejects 10s later,
 * so a request that should cost nothing instead hangs for the full timeout.
 */
export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Resolve to `fallback` if `work` has not settled within `ms`.
 *
 * Latency-critical paths use this to degrade rather than stall: a slow database
 * costs the user a smaller result set, never a spinner.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
  label: string,
): Promise<{ value: T; timedOut: boolean }> {
  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<"__timeout__">((resolve) => {
    timer = setTimeout(() => resolve("__timeout__"), ms);
  });

  try {
    const result = await Promise.race([work, guard]);
    if (result === "__timeout__") {
      console.warn(`[Timeout] ${label} exceeded ${ms}ms — degrading.`);
      // Swallow the eventual rejection so it never surfaces as unhandled.
      void work.catch(() => {});
      return { value: fallback, timedOut: true };
    }
    return { value: result as T, timedOut: false };
  } catch (err: any) {
    console.warn(`[Timeout] ${label} failed: ${err.message}`);
    return { value: fallback, timedOut: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
