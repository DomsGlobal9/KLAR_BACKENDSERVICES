import mongoose from 'mongoose';
import { config } from './env.config';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
    if (isConnected) {

        return;
    }

    try {
        const conn = await mongoose.connect(config.MONGODB_URI, {
            dbName: 'payment-service',
        });

        isConnected = true;


    } catch (error: any) {

        process.exit(1);
    }
};