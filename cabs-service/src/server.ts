import app from "./app";
import { env } from "./config/env";

const PORT = env.port || 8084;

app.listen(PORT, () => {
    console.log(`
    ==================================================
    🚀 Cabs Service is running!
    📡 Port: ${PORT}
    🔗 Health Check: http://localhost:${PORT}/
    📈 TripJack API Domain: ${env.tripJack.baseUrl}
    ==================================================
    `);
});
