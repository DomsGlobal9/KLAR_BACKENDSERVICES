import dotenv from "dotenv";
dotenv.config();

import { tripJackCabsProvider } from "./providers/tripjack.cabs.provider";

async function main() {
    const bookingId = process.argv[2] || "TJ8051903184042";
    const res = await tripJackCabsProvider.getBookingDetails(bookingId);
    const d = res?.data?.[0];
    console.log("success:", res?.success);
    console.log("order.status:", d?.order?.status);
    console.log("order.paymentStatus:", d?.order?.paymentStatus);
    console.log("order.amount:", d?.order?.amount);
    console.log("order.bookingUserId:", d?.order?.bookingUserId);
    console.log("order.loggedInUserId:", d?.order?.loggedInUserId);
    console.log("bookingUser.userId:", d?.bookingUser?.userId);
    console.log("bookingUser.name:", d?.bookingUser?.name);
    const cab = d?.itemInfos?.CAB;
    console.log("pricing:", JSON.stringify(cab?.pricing));
}

main().catch((e) => {
    console.error("FAIL:", e?.message || e, JSON.stringify(e?.data || {}));
    process.exit(1);
});
