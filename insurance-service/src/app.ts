import express, { Request, Response } from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

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


app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        service: "insurance-service",
        status: "UP",
        description: "TripSafe Insurance microservice — TripJack API v6.0",
    });
});

app.use("/api/insurance", routes);
// app.use("/",              routes); 

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