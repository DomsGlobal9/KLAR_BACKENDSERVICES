# Flight Search Service - Models Documentation

## Overview
This document provides comprehensive documentation for the MongoDB models created for the Flight Search Service, including SearchSession and Flight schemas.

---

## 📋 SearchSession Model

### Purpose
Manages flight search sessions for both authenticated users and guests. Automatically expires after 24 hours using MongoDB TTL index.

### Schema Structure

```typescript
{
  _id: ObjectId,
  userId: ObjectId | null, // null for guest users
  cabinClass: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST",
  paxInfo: {
    adult: number (1-9),
    child: number (0-8),
    infant: number (0-4)
  },
  searchModifiers: {
    isDirectFlight: boolean,
    isConnectingFlight: boolean,
    pft: "REGULAR" | "STUDENT" | "SENIOR_CITIZEN"
  },
  preferredAirlines: string[], // Array of airline codes
  routes: [
    {
      from: string (3 chars),
      to: string (3 chars),
      travelDate: Date,
      routeIndex: number
    }
  ],
  createdAt: Date,
  updatedAt: Date,
  expiresAt: Date // TTL index
}
```

### Validation Rules

1. **Passenger Count**:
   - Adults: 1-9
   - Children: 0-8
   - Infants: 0-4
   - Total passengers: Maximum 9
   - Infants cannot exceed adults

2. **Routes**:
   - Minimum: 1 route
   - Maximum: 6 routes (multi-city)
   - Airport codes: Exactly 3 characters

3. **Expiry**:
   - Default: 24 hours from creation
   - Can be extended using API

### Indexes

```javascript
// TTL Index - Auto-delete expired sessions
{ expiresAt: 1 } with expireAfterSeconds: 0

// Query optimization
{ userId: 1, createdAt: -1 }
```

### Instance Methods

```typescript
isExpired(): boolean
// Returns true if session has expired
```

### Static Methods

```typescript
findActiveByUserId(userId: ObjectId): Promise<ISearchSession[]>
// Finds all active (non-expired) sessions for a user
```

### Virtual Properties

```typescript
tripType: "ONE_WAY" | "ROUND_TRIP" | "MULTI_CITY"
// Automatically calculated based on number of routes
```

---

## ✈️ Flight Model

### Purpose
Stores flight search results from suppliers (TripJack, etc.) with automatic expiry after 30 minutes.

### Schema Structure

```typescript
{
  _id: ObjectId,
  searchSessionId: ObjectId (ref: SearchSession),
  supplierId: string, // "TRIPJACK", "AMADEUS", etc.
  supplierReference: string (unique),
  
  // Flight Details
  segments: [
    {
      segmentIndex: number,
      origin: {
        code: string,
        name: string,
        city: string,
        country: string,
        terminal?: string
      },
      destination: {
        code: string,
        name: string,
        city: string,
        country: string,
        terminal?: string
      },
      airline: {
        code: string,
        name: string,
        flightNumber: string
      },
      departureTime: Date,
      arrivalTime: Date,
      duration: number (minutes),
      stops: number,
      cabin: string,
      aircraft: string,
      baggage: {
        checkIn: string,
        cabin: string
      }
    }
  ],
  totalDuration: number (minutes),
  stops: number,
  
  // Pricing
  fareDetails: {
    adult: {
      baseFare: number,
      taxes: number,
      fees: number,
      total: number,
      currency: string
    },
    child?: { ... },
    infant?: { ... }
  },
  totalPrice: number,
  currency: string,
  
  // Booking Details
  cabinClass: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST",
  availableSeats: number,
  refundable: boolean,
  fareRules?: string,
  baggage: {
    checkIn: string,
    cabin: string
  },
  
  // Metadata
  isActive: boolean,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Validation Rules

1. **Segments**:
   - Minimum: 1 segment
   - Airport codes: Exactly 3 characters

2. **Pricing**:
   - All amounts must be >= 0
   - Adult fare is required
   - Child and infant fares are optional

3. **Expiry**:
   - Default: 30 minutes from creation
   - Auto-deleted via TTL index

### Indexes

```javascript
// TTL Index - Auto-delete expired flights
{ expiresAt: 1 } with expireAfterSeconds: 0

// Query optimization
{ searchSessionId: 1, isActive: 1, expiresAt: 1 }
{ supplierId: 1, supplierReference: 1 }
{ totalPrice: 1, stops: 1 } // For sorting
```

### Instance Methods

```typescript
isExpired(): boolean
// Returns true if flight has expired

getLayoverTime(segmentIndex: number): number | null
// Calculates layover time between segments in minutes
```

### Static Methods

```typescript
findBySearchSession(
  searchSessionId: ObjectId,
  options?: {
    maxPrice?: number,
    directOnly?: boolean,
    airlines?: string[]
  }
): Promise<IFlight[]>
// Finds flights for a search session with optional filters
```

### Virtual Properties

```typescript
isDirect: boolean
// True if stops === 0

origin: IAirport
// First segment's origin

destination: IAirport
// Last segment's destination
```

### Pre-Save Hooks

```typescript
// Automatically calculates totalDuration from segments
// Duration = last segment arrival - first segment departure
```

---

## 🛣️ API Endpoints

### Search Session Endpoints

```
POST   /api/search-sessions              Create new search session
GET    /api/search-sessions/:sessionId   Get search session by ID
GET    /api/search-sessions/user/:userId Get user's search sessions
DELETE /api/search-sessions/:sessionId   Delete search session
PATCH  /api/search-sessions/:sessionId/extend  Extend session expiry
```

### Example: Create Search Session

**Request:**
```json
POST /api/search-sessions
{
  "userId": "507f1f77bcf86cd799439011", // or null for guest
  "cabinClass": "ECONOMY",
  "paxInfo": {
    "adult": 2,
    "child": 1,
    "infant": 0
  },
  "searchModifiers": {
    "isDirectFlight": true,
    "isConnectingFlight": false,
    "pft": "REGULAR"
  },
  "preferredAirlines": ["AI", "6E"],
  "routes": [
    {
      "from": "DEL",
      "to": "BOM",
      "travelDate": "2026-03-10T00:00:00.000Z",
      "routeIndex": 0
    },
    {
      "from": "BOM",
      "to": "DEL",
      "travelDate": "2026-03-15T00:00:00.000Z",
      "routeIndex": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Search session created successfully",
  "data": {
    "sessionId": "507f1f77bcf86cd799439012",
    "searchSession": { ... }
  }
}
```

---

## 🔧 Usage Examples

### Creating a Search Session

```typescript
import { SearchSession } from "./models/SearchSession";

const session = new SearchSession({
  userId: null, // Guest user
  cabinClass: "ECONOMY",
  paxInfo: {
    adult: 1,
    child: 0,
    infant: 0
  },
  searchModifiers: {
    isDirectFlight: false,
    isConnectingFlight: true,
    pft: "REGULAR"
  },
  routes: [
    {
      from: "DEL",
      to: "BOM",
      travelDate: new Date("2026-03-10"),
      routeIndex: 0
    }
  ]
});

await session.save();
```

### Creating a Flight

```typescript
import { Flight } from "./models/Flight";

const flight = new Flight({
  searchSessionId: session._id,
  supplierId: "TRIPJACK",
  supplierReference: "TJ123456",
  segments: [
    {
      segmentIndex: 0,
      origin: {
        code: "DEL",
        name: "Indira Gandhi International Airport",
        city: "Delhi",
        country: "India"
      },
      destination: {
        code: "BOM",
        name: "Chhatrapati Shivaji Maharaj International Airport",
        city: "Mumbai",
        country: "India"
      },
      airline: {
        code: "AI",
        name: "Air India",
        flightNumber: "AI860"
      },
      departureTime: new Date("2026-03-10T06:00:00"),
      arrivalTime: new Date("2026-03-10T08:30:00"),
      duration: 150,
      stops: 0,
      cabin: "Economy",
      aircraft: "Boeing 787",
      baggage: {
        checkIn: "15 KG",
        cabin: "7 KG"
      }
    }
  ],
  fareDetails: {
    adult: {
      baseFare: 5000,
      taxes: 1000,
      fees: 200,
      total: 6200,
      currency: "INR"
    }
  },
  totalPrice: 6200,
  currency: "INR",
  cabinClass: "ECONOMY",
  availableSeats: 9,
  refundable: false,
  baggage: {
    checkIn: "15 KG",
    cabin: "7 KG"
  }
});

await flight.save();
```

### Querying Flights

```typescript
// Find all active flights for a search session
const flights = await Flight.findBySearchSession(sessionId, {
  maxPrice: 10000,
  directOnly: true,
  airlines: ["AI", "6E"]
});

// Check if flight is expired
if (flight.isExpired()) {
  console.log("Flight has expired");
}

// Get layover time
const layoverTime = flight.getLayoverTime(0);
console.log(`Layover: ${layoverTime} minutes`);
```

---

## 📊 Database Maintenance

### TTL Index Behavior

- MongoDB automatically deletes documents when `expiresAt` time is reached
- Background task runs every 60 seconds
- Documents may persist for up to 60 seconds after expiry

### Manual Cleanup (if needed)

```javascript
// Remove expired search sessions
db.searchsessions.deleteMany({ expiresAt: { $lt: new Date() } });

// Remove expired flights
db.flights.deleteMany({ expiresAt: { $lt: new Date() } });
```

---

## 🔐 Security Considerations

1. **Guest Users**: Sessions with `userId: null` are allowed
2. **Data Expiry**: Automatic cleanup prevents data accumulation
3. **Validation**: All inputs are validated at schema level
4. **Indexing**: Optimized for performance and automatic cleanup

---

## 📝 Files Created

1. `src/models/SearchSession.ts` - SearchSession model
2. `src/models/Flight.ts` - Flight model
3. `src/models/index.ts` - Model exports
4. `src/controllers/searchSessionController.ts` - SearchSession controller
5. `src/routes/searchSession.routes.ts` - SearchSession routes

---

## ✅ Next Steps

1. Create Flight controller and routes
2. Integrate with TripJack API service
3. Add authentication middleware for protected routes
4. Implement caching strategy
5. Add comprehensive error handling
6. Write unit tests for models and controllers

---

## 🎯 Key Features

✅ TTL indexes for automatic data cleanup
✅ Support for guest and authenticated users
✅ Multi-city flight support (up to 6 routes)
✅ Comprehensive validation
✅ Optimized database indexes
✅ Type-safe TypeScript interfaces
✅ RESTful API endpoints
✅ Virtual properties for computed fields
✅ Instance and static methods
✅ Pre-save hooks for data integrity
