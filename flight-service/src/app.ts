import express from "express";
import cors from "cors";

import { corsMiddleware } from "./config";
import routes from "./routes";

import { initializeCrons } from "./cron";
import { globalRateLimiter } from "./middlewares/rateLimiter";

const app = express();

export const setupApp = () => {

  app.use(globalRateLimiter);

  app.use(express.json());

  app.use(cors(corsMiddleware));

  initializeCrons();

  app.get("/", (_req, res) => {
    res.send("Flight Service is running 🚀");
  });

  app.use("/api/flight", routes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {


      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  );
};

export default app;