import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db.config'
import routes from "./routes";

dotenv.config();

const app = express();

const PORT = process.env.PORT;
console.log("ENV PORT", PORT);
// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.use('/api/visa', routes);

app.get('/', (req, res) => {
    res.json({
        message: 'Visa Service API',
        endpoints: {
            api: '/api',
            health: '/health'
        }
    });
});



// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});