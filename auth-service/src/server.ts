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
