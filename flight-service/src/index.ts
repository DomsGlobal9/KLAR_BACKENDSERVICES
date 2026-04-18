import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);

import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { envConfig, connectDB, RedisConfig } from "./config";

const startServer = async () => {
  try {
    await connectDB();

    RedisConfig.getInstance();

    app.listen(envConfig.PORT, () => {
      console.log(`Project is running on port ${envConfig.PORT}`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
};



startServer();