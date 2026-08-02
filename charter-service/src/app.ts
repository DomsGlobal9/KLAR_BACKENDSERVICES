import express from "express";
import cors from "cors";
import { corsOptions } from "./config";
import routes from "./routes";


const app = express();

export const setupApp = () => {

  app.use(express.json());

  app.use(cors(corsOptions));

  app.get("/", (_req, res) => {
    res.send("Charter Service is running 🚀");
  });

  app.use("/api/charter", routes);

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
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  );
};

export default app;