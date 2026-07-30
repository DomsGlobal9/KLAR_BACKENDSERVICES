import express from "express";
import { envConfig } from "./config/env.config";
import nodemailer from "nodemailer";
import { corsMiddleware } from "./config/cors.config";
import routes from "./routes";

const app = express();

app.use(express.json());
app.use(corsMiddleware);

export const mailTransporter = nodemailer.createTransport({
  host: envConfig.SMTP_HOST,
  port: envConfig.SMTP_PORT,
  secure: envConfig.SMTP_SECURE,
  auth: {
    user: envConfig.SMTP_USER,
    pass: envConfig.SMTP_PASS,
  },
});

app.use("/api/v1", routes);

mailTransporter.verify()
  .then(() => console.log("Mail transporter is ready"))
  .catch((err) => console.error("Mail transporter error:", err));

app.get("/", (req, res) => {
  res.send("Email Service is running 🚀");
});

app.use((err: any, req: any, res: any, next: any) => {

  res.status(500).json({ message: "Internal Server Error" });
});

export default app;