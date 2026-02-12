import express from "express";
import cookieParser from "cookie-parser";
import { contextResolver } from "./middlewares/context.middleware";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";
import cors from "cors";
import { corsOptions } from "./config/cors.config";

const app = express();

app.use(cors(corsOptions));


app.options("/", cors(corsOptions));


app.get("/health", (req, res) => {
    console.log("Health check");
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "auth-service"
    });
});

app.use(express.json());
app.use(cookieParser());


app.use(contextResolver);


app.use("/b2b", routes);

app.use(errorHandler);

export default app;