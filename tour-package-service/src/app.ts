import express from "express";
import cors from "cors";
import routes from "./routes";
import { corsMiddleware } from "./config";


const app = express();

export const setupApp = () => {
  // Middleware
  app.use(express.json());
  app.use(cors(corsMiddleware));

  app.get("/", (_req, res) => {
    res.send("Tour Package Service is running 🚀");
  });

  app.use("/api/tours", routes);

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
      console.error("Global Error:", err);

      res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  );
};

export default app;