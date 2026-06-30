import mongoose from "mongoose";
import { envConfig } from "./env.config";

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(envConfig.MONGODB_URI, {
            dbName: envConfig.DB_NAME,
        });

        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    }
};