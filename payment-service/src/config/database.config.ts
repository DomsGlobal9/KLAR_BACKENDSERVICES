import mongoose from 'mongoose';
import { config } from './env.config';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
    if (isConnected) {
        console.log('MongoDB already connected');
        return;
    }

    try {
        const conn = await mongoose.connect(config.MONGODB_URI, {
            dbName: 'payment-service',
        });

        isConnected = true;

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
};