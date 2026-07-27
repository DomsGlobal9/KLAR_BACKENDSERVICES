import mongoose from "mongoose";
import { envConfig } from "./env.config";

export const connectDB = async () => {
    try {
        await mongoose.connect(envConfig.DATABASE.MONGODB_URI);

    } catch (error) {

        process.exit(1);
    }
};
