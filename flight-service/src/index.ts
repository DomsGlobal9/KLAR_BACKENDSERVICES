import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);

import app, { setupApp } from "./app";
import dotenv from "dotenv";
import { envConfig, connectDB, RedisConfig } from "./config";

dotenv.config();

const startServer = async () => {

  try {

    await connectDB();

    RedisConfig.getInstance();

    setupApp();

    app.listen(envConfig.PORT, () => {

    });

  } catch (error) {



    process.exit(1);
  }
};



startServer();