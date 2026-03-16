import express from 'express';
import cors from 'express';
import dotenv from 'dotenv';
import paymentRoutes from './routes/payment.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5004;

// Middleware
const corsMiddleware = require('cors');
app.use(corsMiddleware());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/payment', paymentRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'payment-service' });
});

app.listen(PORT, () => {
  console.log(`Payment Service is running on port ${PORT}`);
});
