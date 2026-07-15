import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: process.env.PORT || 5013,
  jwtSecret:
    process.env.JWT_SECRET ||
    "your_super_secret_jwt_key_change_me_in_production",

  rateGain: {
    baseUrl: process.env.RATEGAIN_BASE_URL!,
    apiKey: process.env.RATEGAIN_API_KEY!,
    apiSecret: process.env.RATEGAIN_SECRET_KEY!,
  },

  tripJack: {
    baseUrl:
      process.env.TRIPJACK_BASE_URL || "https://apitest-hms.tripjack.com",
    omsBaseUrl:
      process.env.TRIPJACK_OMS_BASE_URL || "https://apitest-oms.tripjack.com",
    apiKey: process.env.TRIPJACK_API_KEY!,
    agencyId: process.env.TRIPJACK_AGENCY_ID!,
  },

  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:5010",
  paymentServiceUrl:
    process.env.PAYMENT_SERVICE_URL || "http://localhost:5014/api/pay",

  /**
   * Shared secret for service-to-service calls (agent wallet credit, Razorpay
   * refund). Background jobs have no user JWT, so refunds are unavailable
   * without this and stuck bookings stay in MANUAL_REVIEW for ops.
   */
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || "",
};

if (!env.rateGain.baseUrl) {
  console.error("❌ RATEGAIN_BASE_URL is not set. Service will not work.");
}
if (!env.rateGain.apiKey) {
  console.error("❌ RATEGAIN_API_KEY is not set. Service will not work.");
}
if (!env.tripJack.apiKey) {
  console.warn("⚠️  TRIPJACK_API_KEY is not set. TripJack bookings will fail.");
}
if (!env.internalServiceKey) {
  console.warn(
    "⚠️  INTERNAL_SERVICE_KEY is not set. Automatic refunds are disabled; unresolved bookings will be parked in MANUAL_REVIEW.",
  );
}
