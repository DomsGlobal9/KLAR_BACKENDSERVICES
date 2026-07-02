import express, { Request, Response } from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

const corsOptions = {
    origin: [
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

app.options('*', cors(corsOptions));

app.use(express.json({ limit: "2mb" }));


app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        service: "insurance-service",
        status: "UP",
        description: "TripSafe Insurance microservice — TripJack API v6.0",
    });
});

app.use("/api/insurance", routes);
app.use("/",              routes); 

app.use(errorHandler);

export default app;