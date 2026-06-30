const dns = require('dns');
dns.setServers(["1.1.1.1", "1.0.0.1"]);
import mongoose from "mongoose";
import env from "./env.config";

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;