import axios from 'axios';

const AUTH_URL = 'http://localhost:4000/api/auth/login';
const BOOKING_URL = 'http://localhost:5000/api/booking/bookings';

const runTest = async () => {
    try {
        console.log("🚀 Starting E2E Test...");

        // 1. Login
        console.log(`\n1️⃣  Logging into ${AUTH_URL}...`);
        const loginPayload = {
            email: "gmsaisudheer@gmail.com",
            password: "Sudheer@112"
        };

        const loginRes = await axios.post(AUTH_URL, loginPayload);
        const token = loginRes.data?.data?.token || loginRes.data?.token;

        if (!token) {
            console.error("❌ Login Failed: No token received.");
            console.error("Response:", loginRes.data);
            return;
        }

        console.log("✅ Login Successful!");
        console.log(`🔑 Token received: ${token.substring(0, 15)}...`);

        // 2. Save Booking (Protected Route)
        console.log(`\n2️⃣  Attempting to Save Booking at ${BOOKING_URL}...`);

        const bookingPayload = {
            propertyId: "test-prop-123",
            propertyName: "Test Hotel",
            checkIn: new Date().toISOString(),
            checkOut: new Date(Date.now() + 86400000).toISOString(), // +1 day
            totalAmount: 150.00,
            currencyCode: "USD",
            guests: [{
                firstName: "Test",
                lastName: "User",
                email: "test@example.com",
                phone: "1234567890",
                isPrimary: true
            }],
            rooms: [{
                roomTypeCode: "DLX",
                numberOfRooms: 1,
                numberOfAdults: 2,
                numberOfChildren: 0,
                roomRate: 150.00,
                boardName: "Room Only"
            }],
            confirmationNumber: `CONF-${Date.now()}` // Unique ID
        };

        const bookingRes = await axios.post(BOOKING_URL, bookingPayload, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log("✅ Booking Saved Successfully!");
        console.log("📦 Response Status:", bookingRes.status);
        console.log("📦 Booking ID:", bookingRes.data?.data?.id || bookingRes.data?.id || "N/A");

    } catch (error: any) {
        console.error("\n❌ Test Failed!");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error("Data:", error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
};

runTest();
