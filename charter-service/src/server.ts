import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);

import dotenv from "dotenv";
dotenv.config();

import app, { setupApp } from "./app";
import { envConfig, connectDB } from "./config";

const startServer = async () => {
  try {
    await connectDB();

    setupApp();

    app.listen(envConfig.PORT, () => {
      console.log(`🚀 Charter Service running on port ${envConfig.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start Charter Service:", error);
    process.exit(1);
  }
};

startServer();