import { Router } from "express";
import { createInstantBooking } from "../controllers/bookingController";

const router = Router();

router.post("/instant", createInstantBooking);

/**
 * {
  "bookingId": "TJS108201936164",
  "totalAmount": 13663,
  "deliveryEmail": "customer@example.com",
  "deliveryPhone": "+919876543210",
  "emergencyContact": {
    "name": "John Doe",
    "email": "emergency@example.com",
    "phone": "+919876543210"
  },
  "travellers": [
    {
      "type": "adult",
      "title": "Mr",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1990-01-01"
    },
    {
      "type": "child",
      "title": "Master",
      "firstName": "Jani",
      "lastName": "Doe",
      "dateOfBirth": "2020-01-01"
    }
  ]
}
 */

export default router;