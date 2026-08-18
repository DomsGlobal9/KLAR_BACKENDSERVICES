import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';


dotenv.config();
let databaseUrl: string;

if (process.env.NODE_ENV === 'production') {
    databaseUrl = process.env.SUPABASE_PRODUCTION_DATABASE_URL!;
} else if (process.env.NODE_ENV === 'development') {
    databaseUrl = process.env.SUPABASE_DEVELOPMENT_DATABASE_URL!;
} else {
    throw new Error('NODE_ENV is not set or DATABASE_URL is not defined');
}

if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in environment variables');
}

console.log(`Using database for environment: ${process.env.NODE_ENV}`);

export default defineConfig({
    out: './drizzle',
    schema: './src/drizzle/schemas/index.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: databaseUrl,
    },
    breakpoints: true,
});