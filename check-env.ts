import dotenv from "dotenv";
import path from "path";

console.log("Current working directory:", process.cwd());

const envPath = "./hotel-search-service/.env";
console.log("Loading .env from:", envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env file:", result.error);
} else {
    console.log("Dotenv parsed successfully.");
}

console.log("--- Environment Variables Check ---");
console.log("JWT_ACCESS_SECRET:", process.env.JWT_ACCESS_SECRET ? "SET (Value exists)" : "NOT SET");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "SET (Value exists)" : "NOT SET");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "SET" : "NOT SET");

if (process.env.JWT_ACCESS_SECRET) {
    console.log("Value length:", process.env.JWT_ACCESS_SECRET.length);
    console.log("First 5 chars:", process.env.JWT_ACCESS_SECRET.substring(0, 5));
}
