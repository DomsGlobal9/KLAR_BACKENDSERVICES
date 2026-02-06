import dotenv from "dotenv";
import app from "./app";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`✈️  Flights Review Service running on port ${PORT}`);
    console.log(`📝 API Endpoints:`);
    console.log(`   POST http://localhost:${PORT}/api/flights/review`);
    console.log(`   POST http://localhost:${PORT}/api/flights/revalidate`);
    console.log(`\n🚀 Server started successfully!`);
});
