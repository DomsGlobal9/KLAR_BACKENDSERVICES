# Swagger API Documentation Guide

## 🚀 Quick Start

### Accessing Swagger UI

Once your server is running, you can access the interactive API documentation at:

```
http://localhost:3000/api-docs
```

### Starting the Development Server

```bash
npm run dev
```

Then open your browser and navigate to `http://localhost:3000/api-docs`

---

## 📖 Using Swagger UI

### 1. **Explore Available Endpoints**
   - All API endpoints are listed on the Swagger UI page
   - Click on any endpoint to expand and see details
   - Each endpoint shows:
     - HTTP method (POST, GET, etc.)
     - Endpoint path
     - Description
     - Request parameters/body
     - Response schemas

### 2. **Try Out Endpoints**
   
   **Step-by-step:**
   
   a. **Click on an endpoint** (e.g., `POST /api/flights/review`)
   
   b. **Click the "Try it out" button** in the top right
   
   c. **Edit the request body** in the text area:
   ```json
   {
     "searchId": "TJS107700007440",
     "priceIds": ["TJS107700007440_DELBLRUK807_5962124616134657"]
   }
   ```
   
   d. **Click "Execute"** to send the request
   
   e. **View the response** below, including:
      - Response status code
      - Response headers
      - Response body
      - cURL command (for copying)

### 3. **Understanding the Response**

The response section shows:
- **Code**: HTTP status code (200, 400, 500, etc.)
- **Details**: Response headers and body
- **Example Value**: Sample response structure

---

## 🎯 Available Endpoints

### 1. POST /api/flights/review
**Purpose:** Review flight before booking

**Request Body:**
```json
{
  "searchId": "TJS107700007440",
  "priceIds": ["TJS107700007440_DELBLRUK807_5962124616134657"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reviewId": "TJS107700007440",
    "expiresAt": "2024-02-05T12:30:00Z",
    "price": {
      "totalFare": 3617.70,
      "baseFare": 3043.00,
      "taxes": 574.70
    },
    "trips": [...],
    "conditions": {...},
    "ssrAllowed": {...}
  }
}
```

### 2. POST /api/flights/revalidate
**Purpose:** Revalidate fare before final booking

**Request Body:**
```json
{
  "reviewId": "TJS107700007440"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "fareValid": true,
    "price": {...},
    "fareChange": {...},
    "message": "Fare is still valid"
  }
}
```

---

## 🔧 Advanced Features

### Schemas
Click on **"Schemas"** at the bottom of the Swagger UI to see all data models:
- ReviewInput
- ReviewResult
- RevalidateInput
- RevalidateResult
- TotalFare
- Trip
- Segment
- SSRGroup
- BookingConditions
- SSRAvailability
- FareChange

### Export API Specification
You can download the OpenAPI specification in JSON format:
```
http://localhost:3000/api-docs.json
```

This can be used with:
- Postman (Import → OpenAPI)
- API testing tools
- Code generators
- Documentation generators

---

## 💡 Tips

1. **Use the "Try it out" feature** to test endpoints without writing any code
2. **Copy the cURL command** from the response to use in terminal
3. **Check the Schemas section** to understand data structures
4. **Use example values** as templates for your requests
5. **Look at response codes** to understand what went wrong (400, 500, etc.)

---

## 🛠️ Customization

### Update Server URLs
Edit `src/config/swagger.config.ts`:
```typescript
servers: [
  {
    url: "http://localhost:3000",
    description: "Development server"
  },
  {
    url: "https://your-production-url.com",
    description: "Production server"
  }
]
```

### Update API Information
Edit the `info` section in `src/config/swagger.config.ts`:
```typescript
info: {
  title: "Your API Title",
  version: "1.0.0",
  description: "Your API description",
  contact: {
    name: "Your Name",
    email: "your-email@example.com"
  }
}
```

---

## 📚 Resources

- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger Editor](https://editor.swagger.io/) - Online editor for OpenAPI specs

---

## 🐛 Troubleshooting

### Swagger UI not loading?
1. Make sure the server is running (`npm run dev`)
2. Check the console for errors
3. Verify the URL is correct: `http://localhost:3000/api-docs`

### Changes not reflecting?
1. Restart the development server
2. Clear browser cache
3. Check that JSDoc comments are properly formatted with `@swagger`

### TypeScript errors?
Make sure you've installed the type definitions:
```bash
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc
```
