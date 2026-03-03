# Redis Setup Guide for Windows

## Option 1: Using WSL (Recommended)

1. **Install WSL** (if not already installed):
   ```powershell
   wsl --install
   ```

2. **Install Redis in WSL**:
   ```bash
   sudo apt update
   sudo apt install redis-server
   ```

3. **Start Redis**:
   ```bash
   sudo service redis-server start
   ```

4. **Verify Redis is running**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

## Option 2: Using Docker (Easiest)

1. **Install Docker Desktop** for Windows

2. **Run Redis container**:
   ```powershell
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

3. **Verify Redis is running**:
   ```powershell
   docker ps
   ```

4. **Stop Redis** (when needed):
   ```powershell
   docker stop redis
   ```

5. **Start Redis again**:
   ```powershell
   docker start redis
   ```

## Option 3: Memurai (Windows Native)

1. **Download Memurai** (Redis-compatible for Windows):
   https://www.memurai.com/get-memurai

2. **Install and start** the service

3. **It runs on** `localhost:6379` by default

## Option 4: Use Cloud Redis (Production)

For production, consider using:
- **Redis Cloud** (https://redis.com/try-free/)
- **AWS ElastiCache**
- **Azure Cache for Redis**
- **Upstash** (Serverless Redis)

Update `.env` with cloud Redis URL:
```
REDIS_URL=redis://username:password@your-redis-host:6379
```

## Testing Redis Connection

Once Redis is running, start your application:

```powershell
npm run dev
```

You should see:
```
✅ Redis Connected
```

If Redis is not available, you'll see:
```
⚠️ Redis not available, continuing without cache
```

The application will still work, but without caching (slower performance).

## Redis CLI Commands (Useful for Debugging)

```bash
# Connect to Redis
redis-cli

# Check all keys
KEYS *

# Get a specific key
GET "your-key"

# Delete all keys (careful!)
FLUSHALL

# Check Redis info
INFO

# Monitor real-time commands
MONITOR
```

## Current Configuration

Your app is configured to use:
- **URL**: `redis://localhost:6379`
- **Cache TTL**: 300 seconds (5 minutes) for flight searches
- **Graceful Degradation**: App works even if Redis is down
