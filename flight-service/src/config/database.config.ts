import mongoose from "mongoose";
import { envConfig } from "./env.config";

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(envConfig.MONGODB_URI, {
            dbName: envConfig.DB_NAME,
        });


    } catch (error) {

        process.exit(1);
    }
};