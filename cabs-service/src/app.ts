import express, { Request, Response } from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: "5mb" }));

// Health check / Root info
app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        service: "cabs-service",
        status: "UP",
        description: "TripJack Cabs microservice — API v2.0",
    });
});

app.use("/api/cabs", routes);
app.use("/",         routes);

app.use(errorHandler);

export default app;
