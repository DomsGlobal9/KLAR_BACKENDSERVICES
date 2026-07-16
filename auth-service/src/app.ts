import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { contextResolver } from "./middlewares/context.middleware";
import { errorHandler } from "./middlewares/error.middleware";

import { corsOptions } from "./config/cors.config";

import routes from "./routes";

const app = express();

/**
 * CORS explicitly handle preflight
 */
app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
        res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
        res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.header("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type, Authorization, apikey");
        res.header("Access-Control-Allow-Credentials", "true");
        return res.status(200).send();
    }
    next();
});
app.use(cors(corsOptions));

/**
 * Body parser
 */
app.use(express.json());

/**
 * Cookie parser
 */
app.use(cookieParser());

/**
 * Context resolver
 */
app.use(contextResolver);

/**
 * Health Routes
 */
app.get("/", (_req, res) => {
    res.status(200).json({
        message: "Auth service working fine 🚀",
        status: "ok"
    });
});

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "auth-service"
    });
});

/**
 * Main Routes
 */
app.use("/user", routes);

/**
 * 404 Handler
 */
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

/**
 * Global Error Handler
 * MUST BE LAST
 */
app.use(errorHandler);

export default app;