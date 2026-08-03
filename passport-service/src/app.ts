import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();

export const setupApp = () => {
  app.use(express.json());
  app.use(cors());
app.use("/api/passport", routes);

  app.get("/", (_req, res) => {
    res.send("Passport Service is running 🚀");
  });

  // Default 404
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  // Global Error Handler
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