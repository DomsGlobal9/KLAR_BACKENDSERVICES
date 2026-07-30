import mongoose from "mongoose";
import { envConfig } from "./env.config";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(envConfig.MONGO_URI);
    console.log(`MongoDB Connected`);
  } catch (error) {
    console.error(`Database connection error: ${error}`);
    process.exit(1);
  }
};



























// import mongoose from "mongoose";
// import { envConfig } from "./env.config";

// export const connectDB = async () => {
//   try {
//     console.log(`Connecting to MongoDB at: ${envConfig.MONGO_URI}`);
    
//     const conn = await mongoose.connect(envConfig.MONGO_URI, {
//       serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging indefinitely
//     });

//     console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`❌ Database connection error:`, error);
//     process.exit(1);
//   }
// };




























// import mongoose from "mongoose";
// import { envConfig } from "./env.config";

// export const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(envConfig.MONGO_URI, {
//       serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
//     });
//     console.log(`4. ✅ MongoDB Connected: ${conn.connection.host}`);
//   } catch (error: any) {
//     console.error(`4. ❌ MongoDB Connection Failed: ${error.message}`);
//   }
// };