import express from "express";
import cookieParser from "cookie-parser";
import { contextResolver } from "./middlewares/context.middleware";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(express.json());
app.use(cookieParser());

// Context resolver (VERY IMPORTANT)
app.use(contextResolver);

// Routes
app.use("/", routes);

// Global error handler
app.use(errorHandler);

export default app;
