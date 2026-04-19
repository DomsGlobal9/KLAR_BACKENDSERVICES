import express from "express";
import { corsMiddleware } from "./config";
import routes from "./routes"

const app = express();

app.use(express.json());
app.use(corsMiddleware);

app.get("/", (_req, res) => {
  res.send("Flight Service is running 🚀");
});

app.use('/api/flight', routes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Global Error:", err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});


export default app;