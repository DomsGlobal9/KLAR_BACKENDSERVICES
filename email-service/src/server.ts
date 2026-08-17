import app from './app';
import { envConfig } from './config/env.config';
import { getRedisClient, closeRedisClient } from './config/redis.config';
import { initEmailWorker, closeEmailWorker } from './workers/email.worker';
import { closeEmailQueue } from './queues/email.queue';
import { verifyDatabaseIdentity } from './drizzle/db';

const PORT = envConfig.PORT || 5013;

async function startServer() {
    try {
        // Fails fast before any email is accepted if the database is unreachable
        // or the process resolved to an unexpected environment.
        await verifyDatabaseIdentity();

        getRedisClient();

        initEmailWorker();

        const server = app.listen(PORT, () => {
            console.log(`🚀 KLAR CRM Email Service running on port ${PORT}`);
            console.log(`📬 BullMQ Email Worker initialized & processing background jobs`);
        });

        const gracefulShutdown = async (signal: string) => {
            console.log(`\n[Server] Received ${signal}. Stopping process...`);

            if (server) {
                server.close();
            }

            try {
                await Promise.allSettled([
                    closeEmailWorker(),
                    closeEmailQueue(),
                    closeRedisClient(),
                ]);
            } catch (err) {
                // Ignore cleanup errors on exit
            } finally {
                console.log('[Server] Shutdown complete.');
                process.exit(0);
            }
        };

        process.once('SIGINT', () => gracefulShutdown('SIGINT'));
        process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
    } catch (error) {
        console.error('[Server Initialization Error]:', error);
        process.exit(1);
    }
}

startServer();