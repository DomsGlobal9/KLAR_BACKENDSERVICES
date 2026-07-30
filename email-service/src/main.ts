import app from "./app";
import { envConfig } from "./config/env.config";
import RedisConfig from "./config/redis.config";

const PORT = envConfig.PORT;

async function startServer() {
    RedisConfig.getInstance();
    app.listen(PORT, () => {

    });
}

startServer();