# Redis Integration - Complete Guide

## ✅ **Yes, You ARE Using Redis!**

Your Flight Search Service is **fully integrated with Redis** for high-performance caching.

---

## 🎯 **Current Redis Usage**

### **1. Flight Search Caching**
- **Location**: `src/services/tripjackService.ts`
- **Cache Duration**: 5 minutes (300 seconds)
- **What's Cached**: TripJack API flight search results
- **Cache Key**: JSON stringified search payload

### **2. How It Works**

```typescript
// 1. User searches for flights
// 2. Check Redis cache first
const cached = await getCache(cacheKey);
if (cached) {
  return JSON.parse(cached); // ⚡ Instant response
}

// 3. If not cached, call TripJack API
const response = await axios.post(...);

// 4. Store in Redis for 5 minutes
await setCache(cacheKey, JSON.stringify(response.data), 300);
```

### **Benefits**:
- ⚡ **Faster Response**: Cached results return instantly
- 💰 **Cost Savings**: Reduces API calls to TripJack
- 🚀 **Better Performance**: Handles more concurrent users
- 🛡️ **API Rate Limiting**: Protects against rate limits

---

## 📦 **Enhanced Redis Service**

### **Available Functions**

#### **Basic Operations**

```typescript
// Get from cache
const value = await getCache("key");

// Set with TTL (in seconds)
await setCache("key", "value", 300); // 5 minutes

// Delete a key
await deleteCache("key");

// Delete keys matching pattern
await deleteCachePattern("flight:*");

// Check if key exists
const exists = await existsCache("key");

// Get remaining TTL
const ttl = await getTTL("key"); // Returns seconds
```

#### **Advanced Operations**

```typescript
// Increment counter
const count = await incrementCounter("api:calls");

// Get cache statistics
const stats = await getCacheStats();
// Returns: { connected: true, totalKeys: 42, memoryUsed: "1.2M" }

// Check connection status
const connected = isConnected();

// Flush all cache (careful!)
await flushCache();

// Graceful shutdown
await disconnectRedis();
```

#### **Cache Wrapper** (Recommended)

```typescript
// Automatic cache management
const flights = await cacheWrapper(
  "flights:DEL-BOM:2026-03-10",
  300, // TTL in seconds
  async () => {
    // This function only runs on cache miss
    return await fetchFlightsFromAPI();
  }
);
```

---

## 🔧 **Setup Instructions**

### **Option 1: Docker (Recommended - Easiest)**

```powershell
# Start Redis
docker run -d -p 6379:6379 --name redis redis:latest

# Verify it's running
docker ps

# View logs
docker logs redis

# Stop Redis
docker stop redis

# Start again
docker start redis

# Remove container
docker rm -f redis
```

### **Option 2: WSL (Windows Subsystem for Linux)**

```powershell
# Install WSL
wsl --install

# In WSL terminal:
sudo apt update
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping  # Should return: PONG
```

### **Option 3: Memurai (Windows Native)**

1. Download from: https://www.memurai.com/get-memurai
2. Install and run
3. Runs on `localhost:6379` by default

### **Option 4: Cloud Redis (Production)**

Update `.env` with cloud URL:

```env
# Redis Cloud
REDIS_URL=redis://username:password@redis-12345.cloud.redislabs.com:12345

# Or Upstash (Serverless)
REDIS_URL=rediss://default:xxxxx@us1-xxxxx.upstash.io:6379
```

---

## 🏥 **Health Check Endpoints**

### **Check Overall System Health**

```bash
GET http://localhost:5001/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T16:47:19.000Z",
  "services": {
    "api": {
      "status": "up",
      "uptime": 123.45
    },
    "mongodb": {
      "status": "connected",
      "database": "search_service"
    },
    "redis": {
      "status": "connected",
      "totalKeys": 42,
      "memoryUsed": "1.2M"
    }
  },
  "environment": "development"
}
```

### **Check Redis Specifically**

```bash
GET http://localhost:5001/api/health/redis
```

**Response:**
```json
{
  "connected": true,
  "stats": {
    "connected": true,
    "totalKeys": 42,
    "memoryUsed": "1.2M"
  },
  "timestamp": "2026-02-04T16:47:19.000Z"
}
```

---

## 🧪 **Testing Redis**

### **1. Start Your Application**

```powershell
npm run dev
```

**Look for these logs:**
```
🔄 Redis connecting...
✅ Redis Connected and Ready
✅ MongoDB connected successfully
🚀 Flight Search Service running on port 5001
```

### **2. Test Flight Search**

```bash
# First request - Cache MISS (calls API)
POST http://localhost:5001/api/flights/search

# Second request - Cache HIT (instant response)
POST http://localhost:5001/api/flights/search
```

**Console Output:**
```
💾 Cache MISS: {"from":"DEL","to":"BOM",...}
🔍 TripJack Search Request
⚡ Cache HIT: {"from":"DEL","to":"BOM",...}
```

### **3. Monitor Redis**

```bash
# Connect to Redis CLI
redis-cli

# View all keys
KEYS *

# Get a specific key
GET "your-cache-key"

# Monitor real-time commands
MONITOR

# Check memory usage
INFO memory

# Check stats
INFO stats
```

---

## 📊 **Redis CLI Commands**

```bash
# Connection
redis-cli                    # Connect to Redis
redis-cli ping              # Test connection (returns PONG)

# Keys
KEYS *                      # List all keys
KEYS flight:*               # List keys matching pattern
EXISTS key                  # Check if key exists
TTL key                     # Get remaining TTL
DEL key                     # Delete a key
FLUSHALL                    # Delete ALL keys (careful!)

# Values
GET key                     # Get value
SET key value               # Set value
SETEX key 300 value        # Set with TTL (300 seconds)

# Info
INFO                        # General info
INFO memory                 # Memory usage
INFO stats                  # Statistics
DBSIZE                      # Number of keys

# Monitoring
MONITOR                     # Watch all commands in real-time
SLOWLOG GET 10             # Get 10 slowest commands
```

---

## 🎯 **Cache Strategy**

### **Current Implementation**

| Data Type | Cache Duration | Key Pattern |
|-----------|---------------|-------------|
| Flight Search Results | 5 minutes | JSON payload |
| Search Sessions | 24 hours | MongoDB TTL |
| Flight Details | 30 minutes | MongoDB TTL |

### **Recommended Patterns**

```typescript
// Flight searches
const cacheKey = `flights:${from}-${to}:${date}:${passengers}`;
await setCache(cacheKey, JSON.stringify(flights), 300);

// User sessions
const sessionKey = `session:${userId}:${sessionId}`;
await setCache(sessionKey, JSON.stringify(session), 86400); // 24 hours

// API rate limiting
const rateLimitKey = `ratelimit:${userId}:${endpoint}`;
await incrementCounter(rateLimitKey);
await setCache(rateLimitKey, "1", 60); // 1 minute window
```

---

## 🚨 **Troubleshooting**

### **Redis Not Connecting**

**Symptom:**
```
⚠️ Redis not available, continuing without cache
```

**Solutions:**

1. **Check if Redis is running:**
   ```bash
   # Docker
   docker ps | grep redis
   
   # WSL
   sudo service redis-server status
   ```

2. **Check the port:**
   ```bash
   netstat -an | findstr 6379
   ```

3. **Check .env configuration:**
   ```env
   REDIS_URL=redis://localhost:6379
   ```

4. **Test connection manually:**
   ```bash
   redis-cli ping
   ```

### **Cache Not Working**

1. **Check Redis connection status:**
   ```bash
   GET http://localhost:5001/api/health/redis
   ```

2. **Monitor cache operations:**
   ```bash
   redis-cli MONITOR
   ```

3. **Check logs for errors:**
   ```
   Redis GET error: ...
   Redis SET error: ...
   ```

---

## 🔐 **Production Considerations**

### **1. Use Redis Cloud**

```env
# Example: Redis Cloud
REDIS_URL=redis://default:password@redis-12345.cloud.redislabs.com:12345

# Example: Upstash (Serverless)
REDIS_URL=rediss://default:xxxxx@us1-xxxxx.upstash.io:6379
```

### **2. Enable Persistence**

Redis can persist data to disk:

```bash
# In redis.conf
save 900 1      # Save if 1 key changed in 15 minutes
save 300 10     # Save if 10 keys changed in 5 minutes
save 60 10000   # Save if 10000 keys changed in 1 minute
```

### **3. Set Memory Limits**

```bash
# In redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru  # Evict least recently used keys
```

### **4. Enable Authentication**

```bash
# In redis.conf
requirepass your_strong_password

# Update .env
REDIS_URL=redis://:your_strong_password@localhost:6379
```

### **5. Monitor Performance**

```bash
# Check slow queries
redis-cli SLOWLOG GET 10

# Monitor memory
redis-cli INFO memory

# Check hit rate
redis-cli INFO stats | grep keyspace
```

---

## 📈 **Performance Metrics**

### **Expected Improvements**

- **Response Time**: 2000ms → 50ms (40x faster)
- **API Calls**: 100% → 20% (80% cache hit rate)
- **Cost Savings**: ~80% reduction in API costs
- **Concurrent Users**: 10x more capacity

### **Monitoring Cache Effectiveness**

```typescript
// Add cache hit/miss tracking
let cacheHits = 0;
let cacheMisses = 0;

const cached = await getCache(key);
if (cached) {
  cacheHits++;
  console.log(`Cache hit rate: ${(cacheHits/(cacheHits+cacheMisses)*100).toFixed(2)}%`);
} else {
  cacheMisses++;
}
```

---

## ✅ **Summary**

- ✅ **Redis is configured and ready**
- ✅ **Flight searches are cached (5 min)**
- ✅ **Enhanced Redis service with 15+ utility functions**
- ✅ **Health check endpoints available**
- ✅ **Graceful degradation if Redis is unavailable**
- ✅ **Production-ready with proper error handling**

### **Next Steps**

1. **Install Redis** (Docker recommended)
2. **Start your app**: `npm run dev`
3. **Test health check**: `GET /api/health`
4. **Monitor cache**: `redis-cli MONITOR`
5. **Enjoy faster responses!** ⚡

---

## 📚 **Additional Resources**

- [Redis Documentation](https://redis.io/docs/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Redis Cloud](https://redis.com/try-free/)
- [Upstash (Serverless Redis)](https://upstash.com/)
