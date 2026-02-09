import express from "express";
import cookieParser from "cookie-parser";
import { contextResolver } from "./middlewares/context.middleware";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";
import cors from "cors";
import { corsOptions } from "./config/cors.config";

const app = express();

// app.use(cors(corsOptions));
app.use(cors({
    origin: "http://localhost:5999",
    credentials: true,
    allowedHeaders: ["Content-Type", "apikey"],
    methods: ["GET", "POST", "OPTIONS"],
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:5999");
    res.header("Access-Control-Allow-Headers", "Content-Type, apikey");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// app.options("/", cors());

app.use(express.json());
app.use(cookieParser());


app.use(contextResolver);


app.use("/b2b", routes);

app.use(errorHandler);

export default app;