# ✈️ Flights Review Service

A microservice for reviewing and revalidating flight fares before booking. Ensures price accuracy and provides booking conditions.

---

## 🎯 Features

- ✅ **Flight Review**: Get fare details, booking conditions, and SSR options
- ✅ **Fare Revalidation**: Verify fare hasn't changed before final booking
- ✅ **Fare Change Detection**: Automatic detection with percentage calculation
- ✅ **SSR Support**: Seat, meal, baggage, and other special services
- ✅ **Booking Conditions**: DOB requirements, GST details, emergency contact
- ✅ **Type-Safe**: Full TypeScript implementation
- ✅ **Error Handling**: Comprehensive error handling and logging

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/flights/review` | Review flight before booking |
| POST | `/api/flights/revalidate` | Revalidate fare before final booking |

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed API documentation.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your TripJack credentials
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Test the APIs
```bash
# Review Flight
curl -X POST http://localhost:5001/api/flights/review \
  -H "Content-Type: application/json" \
  -d '{"searchId":"SEARCH123","priceIds":["PRICE001"]}'

# Revalidate Fare
curl -X POST http://localhost:5001/api/flights/revalidate \
  -H "Content-Type: application/json" \
  -d '{"reviewId":"TJ123456789"}'
```

---

## 📁 Project Structure

```
FlightsReviewService/
├── src/
│   ├── clients/
│   │   └── tripjack.client.ts      # TripJack API client
│   ├── controllers/
│   │   └── review.controller.ts    # Request handlers
│   ├── services/
│   │   └── review.service.ts       # Business logic
│   ├── routes/
│   │   └── review.routes.ts        # API routes
│   ├── types/
│   │   └── review.types.ts         # TypeScript interfaces
│   ├── mappers/
│   │   └── review.mapper.ts        # Data transformation
│   ├── validators/
│   │   └── review.validator.ts     # Input validation
│   └── utils/
│       └── time.util.ts             # Utility functions
├── app.ts                           # Express app setup
├── .env.example                     # Environment template
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── API_DOCUMENTATION.md             # API docs
└── README.md                        # This file
```

---

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=5001
NODE_ENV=development

# TripJack API
TRIPJACK_TOKEN=your_token_here
TRIPJACK_REVIEW_URL=https://apitest.tripjack.com/fms/v1/review
TRIPJACK_REVALIDATE_URL=https://apitest.tripjack.com/fms/v1/revalidate
```

---

## 📊 Booking Flow

```
1. User searches for flights
   ↓
2. User selects a flight
   ↓
3. Call Review API
   - Get fare details
   - Get booking conditions
   - Get SSR options
   ↓
4. User fills booking form
   ↓
5. Call Revalidate API
   - Verify fare hasn't changed
   - If changed, show user new fare
   ↓
6. Proceed to booking
```

---

## 🎨 Response Examples

### Review Response (Success)
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
    "conditions": {
      "dob": { "adult": true, "child": true, "infant": true },
      "gst": { "mandatory": false, "applicable": true },
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

### Revalidate Response (Fare Changed)
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

## 🧪 Testing

### Manual Testing
```bash
# Start server
npm run dev

# Test review endpoint
curl -X POST http://localhost:5001/api/flights/review \
  -H "Content-Type: application/json" \
  -d '{"searchId":"TEST123","priceIds":["P001"]}'

# Test revalidate endpoint
curl -X POST http://localhost:5001/api/flights/revalidate \
  -H "Content-Type: application/json" \
  -d '{"reviewId":"TJ123456789"}'
```

---

## 📦 Dependencies

### Production
- **express** - Web framework
- **axios** - HTTP client for TripJack API
- **dotenv** - Environment configuration
- **cors** - CORS middleware
- **helmet** - Security headers
- **compression** - Response compression

### Development
- **typescript** - Type safety
- **ts-node** - TypeScript execution
- **@types/*** - Type definitions

---

## ⚠️ Important Notes

1. **Review Expiry**: Review results expire after 15-30 minutes
2. **Always Revalidate**: Call revalidate immediately before booking
3. **Fare Changes**: Handle fare change scenarios gracefully
4. **Error Handling**: Implement retry logic for network errors
5. **Timeouts**: Set appropriate timeouts (20s recommended)

---

## 🔐 Security

- ✅ Environment variables for sensitive data
- ✅ Input validation
- ✅ Error message sanitization
- ✅ CORS configuration
- ✅ Helmet security headers

---

## 📈 Performance

- ⚡ Response time: < 2 seconds (typical)
- 🔄 Timeout: 20 seconds
- 📊 Concurrent requests: Handled by Express

---

## 🐛 Troubleshooting

### Issue: "reviewId is required"
**Solution**: Ensure you're sending `reviewId` in the request body

### Issue: Timeout errors
**Solution**: Check TripJack API status and network connectivity

### Issue: Fare always changing
**Solution**: This is normal - airline fares change frequently. Show user the new fare.

---

## 📚 Documentation

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Type Definitions](./src/types/review.types.ts) - TypeScript interfaces

---

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add proper error handling
3. Update documentation
4. Test thoroughly

---

## 📄 License

ISC

---

## 👥 Support

For issues or questions, please contact the development team.

---

## ✅ Checklist

- [x] Review API implemented
- [x] Revalidate API implemented
- [x] Fare change detection
- [x] Type-safe interfaces
- [x] Error handling
- [x] Documentation
- [x] Environment configuration
- [x] Production ready

---

**Built with ❤️ for seamless flight booking experience**
