/**
 * Typed error used across the cabs-service.
 *
 * Mirrors hotel-booking-service's StructuredError so controllers/clients get a
 * stable machine-readable `code` alongside the human `message`, instead of the
 * ad-hoc `{ status, message }` literals the service used to throw.
 *
 * The error middleware maps `code` -> a sensible HTTP status; anything without a
 * mapping falls back to 400 (client-correctable) so a validation failure never
 * masquerades as a 500.
 */
export class StructuredError extends Error {
  public code: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = "StructuredError";
    this.code = code;
    this.details = details;
  }
}

/**
 * HTTP status for each StructuredError code. Kept here (not in the middleware)
 * so the mapping lives next to the codes that produce it.
 */
export const ERROR_CODE_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  VEHICLE_SOLD_OUT: 409,
  VEHICLE_CHANGED: 409,
  PRICE_CHANGED: 409,
  POLICY_CHANGED: 409,
  QUOTE_EXPIRED: 409,
  DUPLICATE_REQUEST: 409,
  LOCK_UNAVAILABLE: 503,
  CIRCUIT_BREAKER_OPEN: 503,
  INSUFFICIENT_BALANCE: 402,
  WALLET_ERROR: 402,
  PAYMENT_UNVERIFIED: 402,
  PAYMENT_ALREADY_USED: 409,
  SUPPLIER_ERROR: 502,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
};
