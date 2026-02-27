import dotenv from "dotenv";
dotenv.config();

import app from "./app";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Hotel Search Service running on http://localhost:${PORT}`);
    console.log(`   GET  /api/search/destinations`);
    console.log(`   POST /api/search/hotels/search`);
    console.log(`   POST /api/search/hotels/:propertyId/products`);
});
