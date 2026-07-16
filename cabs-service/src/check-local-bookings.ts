import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { CabBookingModel } from "./models/CabBooking.model";
import { env } from "./config/env";

/** Read-only: print local booking + refund state for given booking ids (or the latest 5). */
async function main() {
    await mongoose.connect(env.mongoUri);
    const ids = process.argv.slice(2);
    const query = ids.length ? { bookingId: { $in: ids } } : {};
    const bookings = await CabBookingModel.find(query).sort({ createdAt: -1 }).limit(5);
    for (const b of bookings) {
        console.log(
            JSON.stringify(
                {
                    bookingId: b.bookingId,
                    status: b.status,
                    clientType: b.clientType,
                    totalAmount: b.totalAmount,
                    paymentMethod: b.paymentMethod,
                    razorpayPaymentId: b.razorpayPaymentId,
                    agentId: b.agentId,
                    refund: b.refund
                        ? {
                              status: b.refund.status,
                              amount: b.refund.amount,
                              method: b.refund.method,
                              error: b.refund.error,
                              completedAt: b.refund.completedAt,
                          }
                        : null,
                    failureReason: b.failureReason,
                    createdAt: b.createdAt,
                },
                null,
                2,
            ),
        );
    }
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error("FAIL:", e?.message || e);
    process.exit(1);
});
