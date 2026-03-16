import mongoose from "mongoose";
import { envConfig } from "./env";

/**
 * Connect to MongoDB database
 */
export const connectDB = async (): Promise<boolean> => {
    try {
        const conn = await mongoose.connect(envConfig.DATABASE.MONGODB_URI, {
            dbName: envConfig.DATABASE.DB_NAME,
        });

        console.log(`✅ MongoDB connected successfully`);
        if (conn.connection.db) {
            console.log(`📦 Database: ${conn.connection.db.databaseName}`);
        }
        console.log(`🌐 Host: ${conn.connection.host}`);
        return true;
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        return false;
    }
};

/**
 * Disconnect from MongoDB database
 */
export const disconnectDB = async (): Promise<void> => {
    try {
        await mongoose.disconnect();
        console.log("✅ MongoDB disconnected successfully");
    } catch (error) {
        console.error("❌ MongoDB disconnection failed:", error);
    }
};