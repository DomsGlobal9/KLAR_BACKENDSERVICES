import express from 'express';
import cors from 'cors';
import appRoute from './routes';
import { corsOptions } from './config/cors.config';

const app = express();

app.use(cors(corsOptions));

app.use('/api/pay/razorpay/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', appRoute);
app.use('/api/pay', appRoute);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'payment-service'
  });
});

export default app;