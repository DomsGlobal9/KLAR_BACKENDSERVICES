import app from "./app";
import connectDB from "./config/db";
import env from "./config/env.config";

const startServer = async () => {
  try {
    await connectDB(); // ✅ connect MongoDB

    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error);
  }
};

startServer();