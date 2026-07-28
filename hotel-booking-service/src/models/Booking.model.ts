import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

export enum BookingStatus {
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  PENDING = "PENDING",
  FAILED = "FAILED",
  HELD = "HELD",
  // Granular OTA States
  PRECHECK_VALIDATED = "PRECHECK_VALIDATED",
  PAYMENT_RESERVED = "PAYMENT_RESERVED",
  SUPPLIER_PENDING = "SUPPLIER_PENDING",
  MANUAL_REVIEW = "MANUAL_REVIEW",
  /**
   * We asked the supplier to cancel and are waiting for them to confirm it.
   * Distinct from PENDING: a PENDING booking is one we are trying to CREATE,
   * and conflating the two makes the reconciliation worker refund a cancelling
   * booking in full, ignoring the cancellation penalty.
   */
  CANCELLATION_PENDING = "CANCELLATION_PENDING",
}

export enum BookingProvider {
  RATEGAIN = "rategain",
  TRIPJACK = "tripjack",
}

export enum RefundStatus {
  /** Claimed by a worker; the money movement is in flight. */
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  /** The attempt failed. Safe to retry — no money moved. */
  FAILED = "FAILED",
  /** Nothing to refund back to (no wallet, no captured payment). Needs ops. */
  NOT_APPLICABLE = "NOT_APPLICABLE",
}

export enum RefundMethod {
  /** Agent wallet credit via auth-service. */
  WALLET = "WALLET",
  /** Razorpay refund via payment-service. */
  RAZORPAY = "RAZORPAY",
  NONE = "NONE",
}

/**
 * Why we owe the money back. A retry must reuse the original kind: a
 * cancellation refund is the amount net of penalty, a failed-booking refund is
 * everything the payer paid.
 */
export enum RefundKind {
  FAILED_BOOKING = "FAILED_BOOKING",
  CANCELLATION = "CANCELLATION",
}

/**
 * Refund bookkeeping. Its presence is what makes refunds idempotent: the
 * in-request poll, the status cron and the reconciliation worker all race to
 * refund the same failed booking, and only the one that claims this subdocument
 * is allowed to move money.
 */
export interface IRefund {
  status: RefundStatus;
  method: RefundMethod;
  kind: RefundKind;
  amount: number;
  referenceId: string;
  providerRefundId?: string;
  reason?: string;
  error?: string;
  attemptedAt?: Date;
  completedAt?: Date;
}

export interface IRoom {
  roomType?: string;
  boardType?: string;
  guests?: number;
  price?: number;
}

export interface ICancellationPolicy {
  isRefundable: boolean;
  deadline?: string; // ISO date string
  penalty?: number; // Amount to be charged
}

export interface IUserInfo {
  id?: string;
  email?: string;
  role?: string;
  clientType?: string;
}

export interface IBooking extends Document {
  // ─── Identifiers ───────────────────────────────
  klarBookingId?: string; // Klar's internal reference number (e.g. KLRH1234567890)
  confirmationNumber: string; // Provider's booking ID (TG-XXXXX). Used for supplier cancel.
  hotelConfirmationNumber?: string; // Real hotel/PMS confirmation number (display only)
  /** Client-supplied dedupe key; unique so retries can't create a second booking. */
  idempotencyKey?: string;
  /** Unguessable token for anonymous guest access (confirmation links) — not the _id. */
  publicToken?: string;
  reservationId: string;
  propertyId: string;
  provider: BookingProvider;
  status: BookingStatus;

  // ─── Stay Details ──────────────────────────────
  checkIn: Date;
  checkOut: Date;
  rooms: IRoom[];

  // ─── Pricing (stored in INR) ───────────────────
  totalAmount: number; // What agent paid (net + markup)
  netAmount: number; // What we paid TripJack/RG
  markupAmount: number; // Klar's earnings
  currencyCode: string;

  // ─── Hotel Display Fields ──────────────────────
  hotelName?: string;
  hotelImage?: string;
  hotelAddress?: string;
  city?: string;
  starRating?: number;
  roomType?: string;
  hotelPhone?: string;
  rateComments?: string;
  paymentType?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  // ─── Guest & Agent ─────────────────────────────
  guestName?: string;
  guestEmail?: string;
  guestMobile?: string;
  agentId?: string;
  agentName?: string;
  userId?: string;
  userInfo?: IUserInfo;
  clientType: string;

  // ─── Cancellation ──────────────────────────────
  cancellationPolicy?: ICancellationPolicy;
  cancelCharge?: number;
  cancellationDetails?: any;
  /** Full charge breakdown captured at cancel time (totals, penalty, refund due). */
  cancelChargesInfo?: any;

  // ─── Provider Request/Response cache ───────────
  tripJackRequest?: any;
  tripJackResponse?: any;
  rateGainRequest?: any;
  rateGainResponse?: any;
  propertyCode?: string;
  brandCode?: string; // RateGain BrandCode stored for cancellation

  // ─── Provider Error (for failed bookings only) ─
  failureReason?: string;

  // ─── Refund bookkeeping ────────────────────────
  refund?: IRefund;

  createdAt?: Date;
  updatedAt?: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    roomType: { type: String },
    boardType: { type: String },
    guests: { type: Number },
    price: { type: Number },
  },
  { _id: false },
);

const cancellationPolicySchema = new Schema<ICancellationPolicy>(
  {
    isRefundable: { type: Boolean, default: false },
    deadline: { type: String },
    penalty: { type: Number },
  },
  { _id: false },
);

const refundSchema = new Schema<IRefund>(
  {
    status: { type: String, enum: Object.values(RefundStatus), required: true },
    method: { type: String, enum: Object.values(RefundMethod), required: true },
    kind: { type: String, enum: Object.values(RefundKind), required: true },
    amount: { type: Number, required: true },
    referenceId: { type: String, required: true },
    providerRefundId: { type: String },
    reason: { type: String },
    error: { type: String },
    attemptedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false },
);

const userInfoSchema = new Schema(
  {
    id: { type: String },
    email: { type: String },
    role: { type: String },
    clientType: { type: String },
  },
  { _id: false },
);

const bookingSchema = new Schema<IBooking>(
  {
    klarBookingId: {
      type: String,
      index: { unique: true, sparse: true },
    },
    confirmationNumber: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    hotelConfirmationNumber: { type: String },
    // Sparse+unique: bookings made before this field existed (null) don't collide,
    // but any two commits sharing a key can never both create a booking.
    idempotencyKey: { type: String, index: { unique: true, sparse: true } },
    // Random 128-bit token minted per booking; anonymous guests use THIS in
    // confirmation links, never the semi-predictable Mongo _id.
    publicToken: {
      type: String,
      default: () => crypto.randomBytes(16).toString("hex"),
      index: true,
    },
    reservationId: { type: String, required: true },
    propertyId: { type: String, required: true },

    provider: {
      type: String,
      enum: Object.values(BookingProvider),
      default: BookingProvider.RATEGAIN,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      index: true,
    },

    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    rooms: { type: [roomSchema], default: [] },

    // Pricing
    totalAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    markupAmount: { type: Number, default: 0 },
    currencyCode: { type: String, required: true, default: "INR" },

    // Hotel display
    hotelName: { type: String },
    hotelImage: { type: String },
    hotelAddress: { type: String },
    city: { type: String },
    starRating: { type: Number },
    roomType: { type: String },
    hotelPhone: { type: String },
    rateComments: { type: String },
    paymentType: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },

    // Guest & Agent
    guestName: { type: String },
    // Guest bookings are looked up by email. Normalize on write so that a
    // booking made as "John@X.com" is found by a login of "john@x.com".
    guestEmail: { type: String, lowercase: true, trim: true },
    guestMobile: { type: String },
    agentId: { type: String, index: true },
    agentName: { type: String },
    userId: { type: String, index: true },
    userInfo: { type: userInfoSchema },
    clientType: { type: String, enum: ["B2B", "B2C", "GUEST"], required: true },

    // Cancellation
    cancellationPolicy: { type: cancellationPolicySchema },
    cancelCharge: { type: Number },
    cancellationDetails: { type: Schema.Types.Mixed },
    cancelChargesInfo: { type: Schema.Types.Mixed },

    // Provider logs/cache
    tripJackRequest: { type: Schema.Types.Mixed },
    tripJackResponse: { type: Schema.Types.Mixed },
    rateGainRequest: { type: Schema.Types.Mixed },
    rateGainResponse: { type: Schema.Types.Mixed },
    propertyCode: { type: String },
    brandCode: { type: String }, // RateGain BrandCode for cancellation

    // Only for debugging failed bookings
    failureReason: { type: String },

    refund: { type: refundSchema },
  },
  {
    timestamps: true,
  },
);

bookingSchema.index({ agentId: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ guestEmail: 1, createdAt: -1 });
bookingSchema.index({ clientType: 1, createdAt: -1 });
bookingSchema.index({ propertyId: 1, checkIn: 1 });

export const BookingModel: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>("Booking", bookingSchema);
