# Environment Configuration Guide

## Overview
This document describes the environment configuration setup for the FlightsSearchService.

## Files Structure

### 1. `.env` - Environment Variables
Contains all sensitive and environment-specific configuration:

```plaintext
# Application Configuration
NODE_ENV=development
PORT=5001
API_PREFIX=/api
BASE_URL=http://localhost:5001/api/

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
DB_NAME=search_service

# TripJack API Configuration
TRIPJACK_BASE_URL=https://apitest.tripjack.com
TRIPJACK_API_KEY=your_api_key
TRIPJACK_AGENCY_ID=your_agency_id

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### 2. `src/config/env.ts` - Environment Configuration Module
Exports the `envConfig` object with typed environment variables:

```typescript
export const envConfig = {
    NODE_ENV: string,
    BASE: {
        PORT: number,
        API_PREFIX: string,
        BASE_URL: string,
    },
    DATABASE: {
        MONGODB_URI: string,
        DB_NAME: string,
    },
    TRIPJACK: {
        BASE_URL: string,
        API_KEY: string,
        AGENCY_ID: string,
    },
    REDIS: {
        URL: string,
    },
};
```

### 3. `src/config/database.ts` - Database Connection Module
Handles MongoDB connection using Mongoose:

```typescript
export const connectDB = async (): Promise<void>
export const disconnectDB = async (): Promise<void>
```

## Usage

### Importing Configuration
```typescript
import { envConfig } from "./config/env";

// Access configuration
const port = envConfig.BASE.PORT;
const mongoUri = envConfig.DATABASE.MONGODB_URI;
const tripjackKey = envConfig.TRIPJACK.API_KEY;
```

### Database Connection
```typescript
import { connectDB } from "./config/database";

// Connect to MongoDB
await connectDB();
```

## Environment Helpers
```typescript
import { isDevelopment, isProduction, isTest } from "./config/env";

if (isDevelopment) {
    // Development-specific code
}
```

## Setup Instructions

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the values in `.env`:**
   - Set your MongoDB connection string
   - Add your TripJack API credentials
   - Configure Redis URL if needed

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Run in development:**
   ```bash
   npm run dev
   ```

## Security Notes

- ⚠️ **Never commit `.env` to version control**
- ✅ Always use `.env.example` as a template
- ✅ Keep sensitive credentials secure
- ✅ Use different `.env` files for different environments

## Validation

The configuration includes automatic validation:
- Required environment variables will throw errors if missing
- Optional variables have sensible defaults
- Type safety is enforced through TypeScript

## Changes Made

1. ✅ Cleaned up and organized `.env` file
2. ✅ Created `.env.example` template
3. ✅ Refactored `env.ts` to use consistent `envConfig` export
4. ✅ Updated `database.ts` with better error handling and logging
5. ✅ Fixed all imports across the codebase to use `envConfig`
6. ✅ Added MongoDB connection to server startup
7. ✅ Installed missing dependencies (mongoose, @types/mongoose)
8. ✅ Fixed TypeScript strict mode errors
9. ✅ Verified build passes successfully
