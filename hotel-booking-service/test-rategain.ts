import axios from "axios";
import { env } from "./src/config/env";

const rateGainClient = axios.create({
  baseURL: env.rateGain.baseUrl,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    ApiKey: env.rateGain.apiKey,
    ApiSecret: env.rateGain.apiSecret,
  },
});

async function run() {
  console.log("Testing RateGain PreCheck with ONE guest...");
  try {
    const payload = {
      BookReservation: {
        ResStatus: 1,
        CurrencyCode: "USD",
        GuaranteeMethod: "CreditCard",
        GuaranteeType: "Guarantee",
        propertyID: "e3c83424-de4f-40e1-aa8c-a51661924cd4",
        PropertyId: "e3c83424-de4f-40e1-aa8c-a51661924cd4",
        PropertyCode: "e3c83424-de4f-40e1-aa8c-a51661924cd4",
        BrandCode: "N/A",
        checkin: "2026-05-30",
        checkout: "2026-05-31",
        CountryCode: "IN",
        Currency: "USD",
        EchoToken: `echo-test-${Date.now()}`,
        Session: "",
        RoomSelection: [
          {
            RoomTypeCode: "DBL.ST",
            NumberOfRooms: 1,
            NumberOfAdults: 2,
            NumberOfChild: 0,
            RoomSelectionKey:
              "20260530|20260531|W|71|6852|DBL.ST|HBG-SELECT|RO||1~2~0||N@07~~24980~848655279~N~~~NOR~~42C2DBB552354B5178012625189705AAUS0001000000000524980",
            RoomRate: 12806.7,
            BoardName: "ROOM ONLY",
            Guest: [
              {
                FirstName: "SUDHEER",
                LastName: "GANTA",
                Primary: true,
                Email: "gmsaisudheer@gmail.com",
                EmailType: 1,
                ProfileType: 1,
                Phone: "9396444455",
                Line1: "Calle Adelita S/N;Calle Adelita S/N; ",
                City: "ZIHUATANEJO",
                StateCode: "TN",
                CountryCode: "IN",
                PostalCode: "500001",
              },
            ],
          },
        ],
      },
    };

    const res = await rateGainClient.post(
      "/api/SmartDistribution/PreCheckReservation",
      payload,
    );
    console.log("Success:", res.status, res.data);
  } catch (e: any) {
    console.error(
      "Error:",
      e.response?.status,
      JSON.stringify(e.response?.data || e.message),
    );
  }
}
run();
