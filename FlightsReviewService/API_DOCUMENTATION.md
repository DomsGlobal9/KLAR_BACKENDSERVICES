# Flight Review Service API Documentation

## Overview
The Flight Review Service provides APIs for reviewing and revalidating flight fares before booking. This ensures price accuracy and provides booking conditions.

---

## 🛣️ API Endpoints

### 1. Review Flight
**POST** `/api/flights/review`

Reviews a flight before booking, validates fare, and retrieves booking conditions and SSR (Special Service Request) options.

#### Request Body
```json
{
  "searchId": "string",
  "priceIds": ["string"]
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "reviewId": "TJ123456789",
    "expiresAt": "2026-02-04T18:30:00.000Z",
    "price": {
      "totalFare": 6200,
      "baseFare": 5000,
      "taxes": 1200,
      "currency": "INR"
    },
    "trips": [
      {
        "priceId": "PR123",
        "fareIdentifier": "FARE_ID_123",
        "segments": [
          {
            "segmentId": "SEG001",
            "from": "DEL",
            "to": "BOM",
            "departure": "2026-03-10T06:00:00.000Z",
            "arrival": "2026-03-10T08:30:00.000Z",
            "airline": "AI",
            "flightNumber": "AI860",
            "ssr": [
              {
                "type": "MEAL",
                "options": [
                  {
                    "code": "VGML",
                    "amount": 500,
                    "description": "Vegetarian Meal"
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "conditions": {
      "dob": {
        "adult": true,
        "child": true,
        "infant": true
      },
      "gst": {
        "mandatory": false,
        "applicable": true
      },
      "emergencyContactRequired": true,
      "holdAllowed": false
    },
    "ssrAllowed": {
      "seat": true,
      "meal": true,
      "baggage": true,
      "hold": false,
      "frequentFlier": true
    }
  }
}
```

#### Fare Change Response (200 OK)
If fare has changed since search:
```json
{
  "success": true,
  "data": {
    "fareChange": {
      "oldFare": 6200,
      "newFare": 6500,
      "difference": 300,
      "percentageChange": 4.84
    }
  }
}
```

#### Error Response (400 Bad Request)
```json
{
  "success": false,
  "message": "Failed to review flight"
}
```

---

### 2. Revalidate Fare
**POST** `/api/flights/revalidate`

Revalidates the fare before final booking to ensure the price hasn't changed since review.

#### Request Body
```json
{
  "reviewId": "TJ123456789"
}
```

#### Success Response - Fare Valid (200 OK)
```json
{
  "success": true,
  "data": {
    "success": true,
    "fareValid": true,
    "price": {
      "totalFare": 6200,
      "baseFare": 5000,
      "taxes": 1200,
      "currency": "INR"
    },
    "message": "Fare is valid and unchanged"
  }
}
```

#### Fare Changed Response (409 Conflict)
```json
{
  "success": false,
  "data": {
    "success": false,
    "fareValid": false,
    "fareChange": {
      "oldFare": 6200,
      "newFare": 6500,
      "difference": 300,
      "percentageChange": 4.84
    },
    "message": "Fare has changed. New fare: 6500, Old fare: 6200"
  }
}
```

#### Validation Error (400 Bad Request)
```json
{
  "success": false,
  "message": "reviewId is required"
}
```

#### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Failed to revalidate fare"
}
```

---

## 📊 Response Status Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success - Request completed successfully |
| 400 | Bad Request - Invalid input or validation error |
| 409 | Conflict - Fare has changed (revalidate only) |
| 500 | Internal Server Error - Server-side error |

---

## 🔄 Booking Flow

```
1. Search Flights
   ↓
2. Select Flight
   ↓
3. Review Flight (POST /api/flights/review)
   ↓
4. User fills booking details
   ↓
5. Revalidate Fare (POST /api/flights/revalidate)
   ↓
6. If fare valid → Proceed to booking
   If fare changed → Show user new fare and ask for confirmation
```

---

## 💡 Usage Examples

### Example 1: Review Flight

**Request:**
```bash
curl -X POST http://localhost:5001/api/flights/review \
  -H "Content-Type: application/json" \
  -d '{
    "searchId": "SEARCH123",
    "priceIds": ["PRICE001", "PRICE002"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reviewId": "TJ123456789",
    "expiresAt": "2026-02-04T18:30:00.000Z",
    "price": {
      "totalFare": 6200,
      "baseFare": 5000,
      "taxes": 1200
    },
    ...
  }
}
```

### Example 2: Revalidate Fare

**Request:**
```bash
curl -X POST http://localhost:5001/api/flights/revalidate \
  -H "Content-Type: application/json" \
  -d '{
    "reviewId": "TJ123456789"
  }'
```

**Response (Fare Valid):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "fareValid": true,
    "price": {
      "totalFare": 6200,
      "baseFare": 5000,
      "taxes": 1200
    },
    "message": "Fare is valid and unchanged"
  }
}
```

**Response (Fare Changed):**
```json
{
  "success": false,
  "data": {
    "success": false,
    "fareValid": false,
    "fareChange": {
      "oldFare": 6200,
      "newFare": 6500,
      "difference": 300,
      "percentageChange": 4.84
    },
    "message": "Fare has changed. New fare: 6500, Old fare: 6200"
  }
}
```

---

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# TripJack API Configuration
TRIPJACK_TOKEN=your_tripjack_token_here
TRIPJACK_REVIEW_URL=https://apitest.tripjack.com/fms/v1/review
TRIPJACK_REVALIDATE_URL=https://apitest.tripjack.com/fms/v1/revalidate

# Server Configuration
PORT=5001
NODE_ENV=development
```

---

## 📝 Data Models

### ReviewInput
```typescript
{
  searchId: string;
  priceIds: string[];
}
```

### ReviewResult
```typescript
{
  reviewId: string;
  expiresAt: string;
  price: TotalFare;
  trips: Trip[];
  conditions: BookingConditions;
  ssrAllowed: SSRAvailability;
  fareChange?: FareChange;
}
```

### RevalidateInput
```typescript
{
  reviewId: string;
}
```

### RevalidateResult
```typescript
{
  success: boolean;
  fareValid: boolean;
  price?: TotalFare;
  fareChange?: FareChange;
  message?: string;
}
```

### FareChange
```typescript
{
  oldFare: number;
  newFare: number;
  difference: number;
  percentageChange: number;
}
```

### TotalFare
```typescript
{
  totalFare: number;
  baseFare: number;
  taxes: number;
  currency?: string;
}
```

---

## ⚠️ Important Notes

1. **Review Expiry**: Review results typically expire after 15-30 minutes. Always check `expiresAt` field.

2. **Fare Changes**: Fares can change between search and review, or between review and booking. Always handle fare change scenarios.

3. **Revalidation**: Always revalidate fare immediately before booking to ensure price accuracy.

4. **Error Handling**: Implement proper error handling for all API calls, especially network timeouts.

5. **Status Codes**: 
   - 200 = Success
   - 409 = Fare changed (not an error, but requires user action)
   - 400/500 = Actual errors

---

## 🚀 Testing

### Test Review API
```bash
npm run dev

# In another terminal
curl -X POST http://localhost:5001/api/flights/review \
  -H "Content-Type: application/json" \
  -d '{"searchId":"TEST123","priceIds":["P001"]}'
```

### Test Revalidate API
```bash
curl -X POST http://localhost:5001/api/flights/revalidate \
  -H "Content-Type: application/json" \
  -d '{"reviewId":"TJ123456789"}'
```

---

## 📚 Additional Resources

- TripJack API Documentation
- Flight Booking Flow Diagram
- Error Code Reference
- SSR Options Guide

---

## ✅ Summary

- ✅ **POST /api/flights/review** - Review flight and get booking conditions
- ✅ **POST /api/flights/revalidate** - Revalidate fare before booking
- ✅ Comprehensive fare change detection
- ✅ Proper error handling and status codes
- ✅ Type-safe interfaces
- ✅ Production-ready implementation
