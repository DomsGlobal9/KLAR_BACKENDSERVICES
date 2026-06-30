import axios from "axios";

async function main() {
  try {
    console.log("Searching hotels in Pune to find a RateGain property...");
    const searchRes = await axios.post(
      "http://localhost:5012/api/search/hotels/search",
      {
        destination: "pune india",
        checkin: "2026-06-25",
        checkout: "2026-06-26",
        rooms: [{ adults: 2, children: 0, childAges: [] }],
        pageNo: 1,
      },
    );

    const hotels = searchRes.data.results || searchRes.data.body || [];
    console.log("Found hotels count:", hotels.length);
    if (hotels.length > 0) {
      console.log("First hotel sample:", JSON.stringify(hotels[0], null, 2));
    }

    const rgHotel = hotels.find(
      (h: any) => h.hotelId && h.hotelId.startsWith("RG:"),
    );

    if (!rgHotel) {
      console.error(
        "No RateGain hotel found in search results. Found:",
        hotels.map((h: any) => h.hotelId || h.id),
      );
      return;
    }

    console.log("Found RateGain Hotel:", rgHotel.hotelId, rgHotel.name);

    console.log("Fetching products for the RateGain hotel...");
    const productsRes = await axios.post(
      `http://localhost:5012/api/search/hotels/${rgHotel.hotelId}/products`,
      {
        PropertyCode:
          rgHotel.propertyCode || rgHotel.hotelId.replace("RG:", ""),
        BrandCode: rgHotel.brandCode || "N/A",
        checkin: "2026-06-25",
        checkout: "2026-06-26",
        Rooms: [{ numberOfRoom: 1, adults: 2, children: 0, childrenAges: [] }],
        destinationCode: "RUSW7Q",
      },
    );

    const body = productsRes.data.body || productsRes.data;
    console.log(
      "Raw RateGain products response structure keys:",
      Object.keys(body),
    );

    const products = body.products || body.results || [];
    if (products.length > 0) {
      const firstProduct = products[0];
      console.log("First product keys:", Object.keys(firstProduct));
      const rates = firstProduct.rate || firstProduct.rates || [];
      if (rates.length > 0) {
        console.log(
          "First rate object details:",
          JSON.stringify(rates[0], null, 2),
        );
      } else {
        console.log("No rates found in first product:", firstProduct);
      }
    } else {
      console.log(
        "No products found in response body:",
        JSON.stringify(body, null, 2).substring(0, 1000),
      );
    }
  } catch (e: any) {
    console.error(
      "Error running diagnostics:",
      e.response?.status,
      e.response?.data || e.message,
    );
  }
}

main();
