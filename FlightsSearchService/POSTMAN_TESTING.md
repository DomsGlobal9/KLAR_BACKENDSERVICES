### Flights Search Service API Testing

#### Base URL: `http://localhost:5001/api`

---

### 1. Root Endpoint (Check Connectivity)
**GET** `/`
- **Description:** Returns a welcome message.
- **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Welcome to Flights Search Service API"
}
```

---

### 2. Search Flights
**POST** `/flights/search`
- **Description:** Searches for flights using TripJack API.
- **Headers:** `Content-Type: application/json`
- **Request Body (Example):**
```json
{
    "searchQuery": {
        "paxInfo": {
            "ADULT": "1",
            "CHILD": "0",
            "INFANT": "0"
        },
        "routeInfos": [
            {
                "fromCityOrAirport": {
                    "code": "DEL"
                },
                "toCityOrAirport": {
                    "code": "BOM"
                },
                "travelDate": "2024-03-25"
            }
        ],
        "searchModifiers": {
            "isDirectFlight": true,
            "isConnectingFlight": false
        }
    }
}
```

- **Success Response (200 OK):**
```json
{
    "success": true,
    "message": "Flights searched successfully",
    "data": {
        "searchResult": {
            "tripInfos": [
                {
                    "ONWARD": [
                        {
                            "sI": [
                                {
                                    "fD": {
                                        "aI": {
                                            "code": "6E",
                                            "name": "IndiGo"
                                        },
                                        "fN": "2132",
                                        "eT": "320"
                                    },
                                    "da": {
                                        "code": "DEL",
                                        "name": "Delhi",
                                        "city": "Delhi",
                                        "country": "India",
                                        "terminal": "3"
                                    },
                                    "aa": {
                                        "code": "BOM",
                                        "name": "Mumbai",
                                        "city": "Mumbai",
                                        "country": "India",
                                        "terminal": "2"
                                    },
                                    "dt": "2024-03-25T07:15:00",
                                    "at": "2024-03-25T09:30:00"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }
}
```

- **Bad Request Response (400 Bad Request):**
```json
{
    "success": false,
    "message": "Invalid search payload: routeInfos is required and cannot be empty"
}
```

---

### 3. Handle Invalid Routes (404)
**GET** `/invalid-route`
- **Success Response (404 Not Found):**
```json
{
    "success": false,
    "message": "Route /api/invalid-route not found"
}
```
