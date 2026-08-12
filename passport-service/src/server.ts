import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);

import dotenv from "dotenv";
dotenv.config();

import app, { setupApp } from "./app";
import { connectDB } from "./config/db";

const startServer = async () => {
  try {
    await connectDB();
    setupApp();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Passport Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();