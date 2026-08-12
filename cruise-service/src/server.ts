import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1", "0.0.0.0", "149.88.103.51"]);


import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db.config';
import routes from './routes';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5008;
console.log("ENV PORT", PORT);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.use('/api/cruise', routes);

app.get('/', (req, res) => {
    res.json({
        message: 'Cruise Service API',
        endpoints: {
            submit: 'POST /api/cruise/submit',
            enquiries: 'GET /api/cruise/enquiries',
            enquiryById: 'GET /api/cruise/enquiries/:id',
            update: 'PATCH /api/cruise/enquiries/:id',
            delete: 'DELETE /api/cruise/enquiries/:id',
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'cruise-service' });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Cruise Service is running on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});
