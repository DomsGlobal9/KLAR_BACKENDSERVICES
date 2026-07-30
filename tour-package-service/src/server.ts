import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);


import "dotenv/config"; 

import app, { setupApp } from "./app";
import { connectDB, envConfig } from "./config";

const startServer = async () => {
  try {
    console.log("Starting server initialization...");

    await connectDB();

    setupApp();

    const PORT = envConfig.PORT
    app.listen(PORT, () => {
      console.log(`🚀 Tour Package Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start Tour Package Service:", error);
    process.exit(1);
  }
};

startServer();