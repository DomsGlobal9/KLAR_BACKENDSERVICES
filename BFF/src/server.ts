// bff/src/server.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());

app.use(cors({
    origin: 'http://localhost:5173',   // Your React frontend
    credentials: true
}));

// Health Check
app.get("/", (req, res) => {
    res.json({ 
        message: "succ " + PORT 
    });
});

app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        message: `Klar BFF is running on port ${PORT}` 
    });
});

// Import Routes
import dashboardRoutes from "./routes/dashboard.routes";

// Use Routes
app.use("/api/dashboard", dashboardRoutes);
// You can add more later: app.use("/api/wallet", walletRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Klar BFF Server running at http://localhost:${PORT}`);
});