import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Canonical internal booking lifecycle. Imported across the service from here.
 *
 *   INITIATED         -> created locally, not yet sent to supplier
 *   PENDING           -> supplier booking created, payment/fulfilment in flight
 *   SUPPLIER_PENDING  -> supplier not yet terminal; being polled/reconciled
 *   CONFIRMED         -> supplier confirmed the ride
 *   FAILED            -> supplier failed the booking
 *   CANCELLED         -> cancelled via amendment
 *   REFUNDED          -> money returned to the wallet
 *   MANUAL_REVIEW     -> could not be auto-resolved; needs ops
 */
export enum CabBookingStatus {
  INITIATED = "INITIATED",
  PENDING = "PENDING",
  SUPPLIER_PENDING = "SUPPLIER_PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

/**
 * Refund lifecycle. Matches hotel/flight so the atomic-claim idempotency works
 * the same way: whoever flips a booking's refund to PROCESSING owns the money
 * movement; every other observer (poll, cron, worker) backs off.
 */
export enum RefundStatus {
  PROCESSING = "PROCESSING", // claimed; money movement in flight
  COMPLETED = "COMPLETED",
  FAILED = "FAILED", // safe to retry — no money moved
  NOT_APPLICABLE = "NOT_APPLICABLE", // nothing to refund to (no wallet/payment) — needs ops
}

/**
 * Why we owe money back. A retry must reuse the original kind: a cancellation
 * refund is net of the supplier penalty (markup retained); a failed-booking
 * refund is everything the customer paid.
 */
export enum RefundKind {
  FAILED_BOOKING = "FAILED_BOOKING",
  CANCELLATION = "CANCELLATION",
}

/** Which sales channel the booking came through. */
export enum ClientType {
  B2B = "B2B", // agent, pays via Klar wallet
  B2C = "B2C", // logged-in customer, pays via Razorpay
  GUEST = "GUEST", // anonymous customer, pays via Razorpay
}

/** How the customer paid / which rail we refund on. */
export enum PaymentMethod {
  WALLET = "WALLET", // agent Klar wallet (B2B)
  GATEWAY = "GATEWAY", // Razorpay (B2C/GUEST)
  NONE = "NONE",
}

export interface ICabBooking extends Document {
  klarBookingId?: string;
  bookingId?: string;
  correlationId?: string;
  /**
   * Deterministic per-attempt fingerprint. UNIQUE (sparse) — the hard backstop
   * against a retried request creating a second booking + double wallet charge.
   */
  idempotencyKey?: string;
  userId?: string;
  supplierCode?: string;
  status: CabBookingStatus;

  // Channel & actor
  clientType?: ClientType;
  agentId?: string;
  agentName?: string;
  userInfo?: {
    id?: string;
    email?: string;
    role?: string;
    clientType?: string;
  };

  // How the customer paid + gateway refs (B2C/GUEST)
  paymentMethod?: PaymentMethod;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  // Journey Details
  pickupDate: Date;
  origin: { displayAddress: string; lat: string; long: string };
  destination: { displayAddress: string; lat: string; long: string };

  // Vehicle & Pricing
  vehicleType: string;
  vehicleCategory?: string;
  totalAmount: number;
  /** Supplier net (excl. platform/agent markup) — the amount we owe TripJack. */
  netAmount?: number;
  /** Platform/agent markup baked into totalAmount. */
  markupAmount?: number;
  /** Fresh supplier-validated total charged (from precheck), for audit. */
  validatedAmount?: number;
  priceValidated?: boolean;
  currency: string;

  // Passenger
  passenger: { firstName: string; lastName: string; email: string; phone: string };

  // Refund bookkeeping. Its presence is what makes refunds idempotent — only the
  // caller that claims (flips status to PROCESSING) moves money.
  refund?: {
    status: RefundStatus;
    method?: PaymentMethod;
    kind?: RefundKind;
    amount?: number;
    referenceId?: string;
    providerRefundId?: string;
    reason?: string;
    error?: string;
    attemptedAt?: Date;
    completedAt?: Date;
  };
  failureReason?: string;

  // Cancellation breakdown captured when the cancel was requested (the penalty
  // depends on *when* we asked, so it is stored, not recomputed at refund time).
  cancelCharge?: number;
  cancelChargesInfo?: any;
  cancellationDetails?: any;

  // Raw payloads
  tripJackRequest?: any;
  tripJackResponse?: any;

  createdAt: Date;
  updatedAt: Date;
}

const CabBookingSchema = new Schema<ICabBooking>(
  {
    klarBookingId: { type: String, unique: true, sparse: true, index: true },
    bookingId: { type: String, unique: true, sparse: true, index: true },
    correlationId: { type: String, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    userId: { type: String, index: true },
    supplierCode: { type: String, default: "TJ" },
    status: {
      type: String,
      enum: Object.values(CabBookingStatus),
      default: CabBookingStatus.INITIATED,
      index: true,
    },
    clientType: {
      type: String,
      enum: Object.values(ClientType),
      default: ClientType.B2C,
      index: true,
    },
    agentId: { type: String, index: true },
    agentName: { type: String },
    userInfo: {
      id: { type: String },
      email: { type: String },
      role: { type: String },
      clientType: { type: String },
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.NONE,
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    pickupDate: { type: Date, required: true },
    origin: {
      displayAddress: { type: String, required: true },
      lat: { type: String },
      long: { type: String },
    },
    destination: {
      displayAddress: { type: String, required: true },
      lat: { type: String },
      long: { type: String },
    },
    vehicleType: { type: String, required: true },
    vehicleCategory: { type: String },
    totalAmount: { type: Number, required: true },
    netAmount: { type: Number },
    markupAmount: { type: Number },
    validatedAmount: { type: Number },
    priceValidated: { type: Boolean, default: false },
    currency: { type: String, default: "INR" },
    passenger: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    refund: {
      status: { type: String, enum: Object.values(RefundStatus) },
      method: { type: String, enum: Object.values(PaymentMethod) },
      kind: { type: String, enum: Object.values(RefundKind) },
      amount: { type: Number },
      referenceId: { type: String },
      providerRefundId: { type: String },
      reason: { type: String },
      error: { type: String },
      attemptedAt: { type: Date },
      completedAt: { type: Date },
    },
    failureReason: { type: String },
    cancelCharge: { type: Number },
    cancelChargesInfo: { type: Schema.Types.Mixed },
    cancellationDetails: { type: Schema.Types.Mixed },
    tripJackRequest: { type: Schema.Types.Mixed },
    tripJackResponse: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const CabBookingModel: Model<ICabBooking> =
  mongoose.models.CabBooking ||
  mongoose.model<ICabBooking>("CabBooking", CabBookingSchema);
