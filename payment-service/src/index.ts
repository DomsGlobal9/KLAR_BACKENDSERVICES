import dotenv from 'dotenv';
dotenv.config();

import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0"]);

import app from './app';
import { connectDB } from './config/database.config';

const PORT = process.env.PORT || 5004;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Payment Service is running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

startServer();