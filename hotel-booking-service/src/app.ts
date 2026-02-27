import express, { Request, Response } from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        service: "hotel-booking-service",
        status: "UP",
        endpoints: {
            precheck: "POST /api/booking/precheck",
            commit: "POST /api/booking/commit",
            cancel: "POST /api/booking/cancel",
            specialRequests: "GET /api/booking/special-requests",
            health: "GET /api/booking/health"
        }
    });
});

app.use("/api/booking", routes);
app.use(errorHandler);

export default app;
