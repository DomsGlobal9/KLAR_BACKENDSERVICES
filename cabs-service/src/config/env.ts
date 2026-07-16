// Trigger reload
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  port: process.env.PORT || 5016,

  tripJack: {
    apiKey: process.env.TRIPJACK_API_KEY || "",
    agencyId: process.env.TRIPJACK_AGENCY_ID || "",
    baseUrl: process.env.TRIPJACK_BASE_URL || "https://apitest-cabs.tripjack.com",
  },

  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret:
    process.env.JWT_SECRET || "your_super_secret_jwt_key_change_me_in_production",

  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:5010",
  emailServiceUrl: process.env.EMAIL_SERVICE_URL || "http://localhost:5015/api/v1",
  /** payment-service base — B2C/GUEST Razorpay verify & refund live under /razorpay. */
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || "http://localhost:5014/api/pay",

  /**
   * Shared secret for service-to-service calls (e.g. background refunds that
   * have no user JWT). Without it, automatic refunds are disabled and stuck
   * bookings are parked in MANUAL_REVIEW for ops.
   */
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || "",

  /** Optional distributed-lock store. When unset the lock is a no-op. */
  redisUrl: process.env.REDIS_URL || "",

  /**
   * Allowed upward price drift between search and book before a booking is
   * rejected as PRICE_CHANGED. Whichever of fixed / percent is larger wins.
   */
  priceTolerance: {
    fixed: num(process.env.PRICE_TOLERANCE_FIXED, 50), // ₹50
    percent: num(process.env.PRICE_TOLERANCE_PERCENT, 5), // or 5%
  },
};

if (!env.tripJack.apiKey) {
  console.warn("⚠️  TRIPJACK_API_KEY is not set. TripJack cab bookings will fail.");
}
if (!env.tripJack.agencyId || !Number.isFinite(Number(env.tripJack.agencyId))) {
  console.warn(
    "⚠️  TRIPJACK_AGENCY_ID is not a valid numeric id. It must be the API-key owner's agency id — bookings will be created but their payment will fail with Access Denied.",
  );
}
if (!env.mongoUri) {
  console.warn("⚠️  MONGODB_URI is not set. Booking persistence is disabled.");
}
if (!env.internalServiceKey) {
  console.warn(
    "⚠️  INTERNAL_SERVICE_KEY is not set. Automatic refunds are disabled; unresolved bookings will be parked in MANUAL_REVIEW.",
  );
}
