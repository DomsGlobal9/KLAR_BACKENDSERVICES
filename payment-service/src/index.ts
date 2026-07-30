import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", '192.168.29.116']);


import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/database.config';

const PORT = process.env.PORT || 5004;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {

    });

  } catch (error) {

    process.exit(1);
  }
};

startServer();