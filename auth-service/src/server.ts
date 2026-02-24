import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1"]);


import app from "./app";
import { connectDB } from "./config/database";
import { envConfig } from "./config/env.config";

const PORT = envConfig.BASE.PORT;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Auth Service running on port ${PORT}`);
    });
};

startServer();
