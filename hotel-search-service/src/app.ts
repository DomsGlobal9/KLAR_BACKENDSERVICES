import express from "express";
import cors from "cors";
import compression from "compression";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";
import { searchRateLimiter } from "./middlewares/rateLimit.middleware";

const app = express();

// gzip every response. A hotel page is 20 hotels plus their images/amenities
// plus the facet counts — a few hundred KB of highly compressible JSON, and the
// audience is largely on Indian mobile networks, so this is most of the
// transfer-time win for the bytes we already produce.
app.use(compression());

// Allowed origins: loaded from env so no code change needed on deployment.
// In .env: ALLOWED_ORIGINS=https://b2b.yourdomain.com,https://b2c.yourdomain.com
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [];

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
];

const ALLOWED_ORIGINS = [...new Set([...envOrigins, ...DEFAULT_DEV_ORIGINS])];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // server-to-server / Postman
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      // In non-production: allow any localhost or local network IP
      if (
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/(localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+):\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-client-type"],
  }),
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "hotel-search-service",
    status: "UP",
    endpoints: {
      destinations: "GET /api/search/destinations",
      popularDestinations: "GET /api/search/destinations/popular",
      hotelSearch: "POST /api/search/hotels/search",
      products: "POST /api/search/hotels/:propertyId/products",
      health: "GET /api/search/health",
      syncHotels: "POST /api/search/sync/hotels",
      syncDestinations: "POST /api/search/sync/destinations",
    },
  });
});

app.use("/api/search", searchRateLimiter, routes);
// app.use("/", routes);
app.use(errorHandler);

export default app;
