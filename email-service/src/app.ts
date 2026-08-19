import cors from 'cors';
import express from 'express';
import routes from './routes';
import { corsOptions } from './config/cors.config';
import { supabaseConfig } from './config/supabase.config';

const app = express();

app.use(express.text({ type: 'text/plain', limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors(corsOptions));

app.use('/api/v1', routes);

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'email-service',
        ...supabaseConfig.healthStatus(),
    });
});

export default app;