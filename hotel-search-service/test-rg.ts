import { rateGainProvider } from "./src/providers/rategain.provider";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  try {
    const res = await rateGainProvider.getBestProperties({
      destinationCode: "DXB",
      checkin: "2026-08-08",
      checkout: "2026-08-10",
      Rooms: [{ adults: 2, children: 0 }],
    });
    
    console.log("Total hotels:", res.body?.length || 0);
    if (res.body && res.body.length > 0) {
      const hotel = res.body[0];
      console.log("\n=== First Hotel Raw Fields ===");
      console.log("propertyId:", hotel.propertyId);
      console.log("propertyName:", hotel.propertyName);
      console.log("propertyCode:", hotel.propertyCode);
      console.log("brandCode:", hotel.brandCode);
      console.log("price:", hotel.price);
      console.log("currency:", hotel.currency);
      console.log("\n=== ALL KEYS ===");
      console.log(Object.keys(hotel).join(", "));
      console.log("\n=== Full hotel JSON ===");
      console.log(JSON.stringify(hotel, null, 2));
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}
test();
