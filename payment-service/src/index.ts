import dotenv from 'dotenv';
dotenv.config();

import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0"]);

import express from 'express';
import cors from 'cors';
import paymentRoutes from './routes/payment.routes';
import { connectDB } from './config/database.config';
import appRoute from './routes';
import { corsOptions } from './config/cors.config';


const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use

app.use('/api', appRoute);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'payment-service' });
});

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