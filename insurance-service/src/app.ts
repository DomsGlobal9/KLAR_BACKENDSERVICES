import express, { Request, Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

if (process.env.TRUST_PROXY) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

const corsOptions = {
    origin: [
        'http://localhost:5009',
        'http://localhost:5008',
        'https://klartravels.com',
        'https://www.klartravels.com',
        'https://b2b.klartravels.com',
        'https://www.b2b.klartravels.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.options('/*splat', cors(corsOptions));

app.use(express.json({ limit: "2mb" }));


app.use(
    rateLimit({
        windowMs: 60_000,
        limit: Number(process.env.RATE_LIMIT_PER_MIN) || 100,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === "/health" || req.path === "/api/insurance/health",
        message: { status: false, statusCode: 429, message: "Too many requests. Please retry shortly." },
    })
);


app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        service: "insurance-service",
        status: "UP",
        description: "TripSafe Insurance microservice — TripJack API v6.0",
    });
});

app.use("/api/insurance", routes); 

app.use((req, res) => {
    console.log(`❌ Route not found: ${req.method} ${req.url}`);
    res.status(404).json({
        error: 'Route not found',
        method: req.method,
        url: req.url
    });
});

app.use(errorHandler);

export default app;