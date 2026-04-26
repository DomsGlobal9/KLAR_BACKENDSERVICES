import dns from "node:dns/promises";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import app from "./app";
import { envConfig } from "./src/config/env";
import { connectDB } from "./src/config/database";

// Extend the Express Request interface
declare global {
  namespace Express {
    interface Request {
      dbConnected: boolean;
    }
  }
}

if (!envConfig?.BASE?.PORT) {
  console.error('Configuration error: PORT not defined');
  process.exit(1);
}

// Global flag to track database connection
let isDatabaseConnected = false;

const startServer = async () => {
  try {
    // Try to connect to MongoDB but don't crash if it fails
    try {
      isDatabaseConnected = await connectDB();
      if (isDatabaseConnected) {
        console.log('✅ Database connection established');
      }
    } catch (dbError) {
      console.error('❌ MongoDB connection failed:', dbError instanceof Error ? dbError.message : 'Unknown error');
      isDatabaseConnected = false;
    }

    if (!isDatabaseConnected) {
      console.log('⚠️  Continuing without database connection...');
      console.log('   Some features may not work properly');
    }

    // Start the server regardless of database connection status
    const server = app.listen(envConfig.BASE.PORT, () => {
      console.log(`✅ Flight Search Service running on port ${envConfig.BASE.PORT}`);
      if (!isDatabaseConnected) {
        console.log('⚠️  Server running in limited mode (no database connection)');
      }
    });

    server.on('error', (error: Error) => {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${envConfig.BASE.PORT} is already in use`);
        console.log(`💡 Try changing the PORT in your .env file or kill the process using this port`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    // Only crash for non-database critical errors
    console.error('Critical error starting server:', error);
    process.exit(1);
  }
};

// Make database status available to routes
app.use((req, res, next) => {
  req.dbConnected = isDatabaseConnected;
  next();
});

startServer();
