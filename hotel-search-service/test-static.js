const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

async function test() {
  try {
    const res = await axios.post(
      "https://b2b.tripjack.com/hms/v3/hotel/static-detail",
      {
        hid: "100000000058",
      },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.TRIPJACK_API_KEY,
        },
      },
    );

    const data = res.data;
    console.log("Root keys:", Object.keys(data));
    if (data.hotel) {
      console.log("data.hotel keys:", Object.keys(data.hotel));
      if (data.hotel.rooms) console.log("Has data.hotel.rooms!");
    }
    if (data.hotelInfo) {
      console.log("data.hotelInfo keys:", Object.keys(data.hotelInfo));
      if (data.hotelInfo.rooms) console.log("Has data.hotelInfo.rooms!");
    }
    if (data.rooms) {
      console.log("Has data.rooms at root!");
      const keys = Object.keys(data.rooms);
      console.log("Room IDs:", keys.slice(0, 5));
      console.log("Room sample:", JSON.stringify(data.rooms[keys[0]], null, 2));
    } else {
      console.log("NO data.rooms at root!");
    }
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}
test();
