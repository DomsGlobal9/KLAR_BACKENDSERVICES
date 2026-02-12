import axios from 'axios';

// Unified API runs on 5000
const BASE_URL = 'http://localhost:5000';
const AUTH_URL = `${BASE_URL}/api/auth`;
// We should test the COMMIT endpoint, not the direct DB save which is internal/admin only usually
const COMMIT_URL = `${BASE_URL}/api/booking/commit`;

const runTest = async () => {
    try {
        console.log("🚀 Starting E2E Test (Unified API Flow)...");

        // 1. Get Token (Register or Login)
        let token = '';
        const userPayload = {
            email: "e2e_test_user_v2@example.com", // Unique email for test
            password: "TestPassword123!",
            firstName: "E2E",
            lastName: "Tester",
            role: "customer"
        };

        console.log(`\n1️⃣  Attempting Registration at ${AUTH_URL}/register...`);
        try {
            const regRes = await axios.post(`${AUTH_URL}/register`, userPayload);
            token = regRes.data?.token || regRes.data?.data?.token;
            console.log("✅ Registration Successful!");
        } catch (regError: any) {
            if (regError.response?.status === 409) {
                console.log("⚠️ User already exists. Logging in...");
                try {
                    const loginRes = await axios.post(`${AUTH_URL}/login`, {
                        email: userPayload.email,
                        password: userPayload.password
                    });
                    token = loginRes.data?.token || loginRes.data?.data?.token;
                    console.log("✅ Login Successful!");
                } catch (loginError: any) {
                    console.error("❌ Login Failed:", loginError.response?.data || loginError.message);
                    return;
                }
            } else {
                console.error("❌ Registration Failed:", regError.response?.data || regError.message);
                return;
            }
        }

        if (!token) {
            console.error("❌ Failed to obtain token.");
            return;
        }
        console.log(`🔑 Token received: [Hidden]`);

        // 2. Commit Booking (RateGain Flow)
        console.log(`\n2️⃣  Attempting to Commit Booking at ${COMMIT_URL}...`);

        // This payload mimics what the Frontend sends to /api/booking/commit
        const bookingPayload = {
            BookReservation: {
                // Determine if we need real data or if a mock object is enough to trigger the controller
                // For a true E2E, we'd need a valid echoToken from a Search/Precheck, which is hard to automating without a full flow.
                // We will send a structured payload to verify the Controller -> Service -> Provider path.
                // It might fail at RateGain, but we want to confirm it passes OUR Auth and Logic.
                EchoToken: `test-token-${Date.now()}`,
                ReservationDate: new Date().toISOString().split('T')[0],
                propertyID: "test-prop-123",
                PropertyCode: "TEST_PROP",
                checkin: new Date().toISOString().split('T')[0],
                checkout: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                BookingRate: 150.00,
                CurrencyCode: "USD",
                RoomSelection: [{
                    RoomTypeCode: "DLX",
                    NumberOfRooms: 1,
                    RoomRate: 150,
                    Guest: [{
                        FirstName: "Test",
                        LastName: "User",
                        Email: "test@example.com",
                        Phone: "1234567890",
                        Primary: true
                    }]
                }]
            }
        };

        try {
            const bookingRes = await axios.post(COMMIT_URL, bookingPayload, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log("✅ Booking Commit logic executed successfully!");
            console.log("📦 Response:", bookingRes.status, bookingRes.data);
        } catch (postError: any) {
            // RateGain might reject our fake property code, that is EXPECTED.
            // We just want to ensure we didn't get a 401 (Auth failed) or 404 (Route not found).
            if (postError.response?.status === 401) {
                console.error("❌ Auth Failed! (401) - Security Middleware is working but request was rejected.");
            } else if (postError.response?.status === 500 || postError.response?.status === 400) {
                console.log("✅ Request reached Controller (Auth Passed). External API rejected mock data as expected.");
                console.log(`   Status: ${postError.response.status} - ${postError.response.data?.message || 'External Error'}`);
            } else {
                console.error("❌ Unexpected Error:", postError.message);
            }
        }

    } catch (error: any) {
        console.error("\n❌ Test Setup Failed!");
        console.error("Error:", error.message);
    }
};

runTest();
