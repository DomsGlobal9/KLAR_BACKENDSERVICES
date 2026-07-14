import { TripJackApiProvider } from "./src/providers/tripjack.api.provider";
import mongoose from "mongoose";

async function test() {
  const p = new TripJackApiProvider();
  try {
    const r = await p.getBookingDetails("TJ203902602979");
    console.log(JSON.stringify(r, null, 2));
  } catch (e: any) {
    console.error(e.response?.data || e.message);
  }
}

test();
