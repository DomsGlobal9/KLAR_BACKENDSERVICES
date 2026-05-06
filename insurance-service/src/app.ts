import express, { Request, Response } from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Root info
app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        service: "insurance-service",
        status: "UP",
        description: "TripSafe Insurance microservice — TripJack API v6.0",
    });
});

app.use("/api/insurance", routes);
app.use("/",              routes); // also mount at root for internal calls

app.use(errorHandler);

export default app;
