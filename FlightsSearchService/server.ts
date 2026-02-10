import app from "./app";
import { envConfig } from "./src/config/env";
import { connectDB } from "./src/config/database";

if (!envConfig?.BASE?.PORT) {
  console.error('Configuration error: PORT not defined');
  process.exit(1);
}

const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully');

    const server = app.listen(envConfig.BASE.PORT, () => {
      console.log(`Flight Search Service running on port ${envConfig.BASE.PORT}`);
    });

    
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${envConfig.BASE.PORT} is already in use`);
        console.log(`💡 Try changing the PORT in your .env file or kill the process using this port`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();