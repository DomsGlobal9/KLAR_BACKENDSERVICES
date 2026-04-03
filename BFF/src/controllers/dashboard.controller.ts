// // bff/src/controllers/dashboard.controller.ts
// import { Request, Response, NextFunction } from "express";
// import axios from "axios";

// const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || "http://localhost:5011";

// export class DashboardController {

//     static async getStats(req: Request, res: Response, next: NextFunction) {
//         try {
//             // Get userId from token (via middleware or header)
//             const userId = req.headers['x-user-id'] || req.query.userId;

//             if (!userId) {
//                 return res.status(401).json({
//                     success: false,
//                     message: "User ID is required"
//                 });
//             }

//             // Call Booking Microservice
//             const bookingResponse = await axios.get(
//                 `${BOOKING_SERVICE_URL}/flights/my-booking/stats`,
//                 {
//                     params: { userId },
//                     timeout: 8000
//                 }
//             ).catch((err) => {
//                 console.warn("Booking service unavailable:", err.message);
//                 return { data: { data: { todaysBookings: 0, monthlyRevenue: 0, pendingActions: 0 } } };
//             });

//             // You can add Wallet call here later when wallet is ready

//             const stats = {
//                 walletBalance: 124592,           // Temporary - will connect to DB later
//                 todaysBookings: bookingResponse.data?.data?.todaysBookings || 18,
//                 monthlyRevenue: bookingResponse.data?.data?.monthlyRevenue || 420000,
//                 pendingActions: bookingResponse.data?.data?.pendingActions || 4,
//             };

//             res.json({
//                 success: true,
//                 data: stats
//             });

//         } catch (error: any) {
//             console.error("Dashboard Error:", error);
//             res.status(500).json({
//                 success: false,
//                 message: "Failed to fetch dashboard data"
//             });
//         }
//     }
// }


// bff/src/controllers/dashboard.controller.ts
import { Request, Response, NextFunction } from "express";
import axios from "axios";

const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || "http://localhost:5010";
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || "http://localhost:5011";

export class DashboardController {

    static async getStats(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.query.userId;
console.log(userId, "user id from dashborad BFF")
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "userId is required (send as query param or x-user-id header)"
                });
            }

            // Call Wallet Service (Port 5010)
            const walletResponse = await axios.get(`${WALLET_SERVICE_URL}/b2b`, {
                headers: {
                    Authorization: req.headers.authorization || '',
                    Cookie: req.headers.cookie || ''
                },
                params: { userId }
            }).catch((err) => {
                console.warn("Wallet Service Error:", err.message);
                return { data: { data: { balance: 0 } } };
            });

            // Call Booking Service (Port 5011)
            const bookingResponse = await axios.get(`${BOOKING_SERVICE_URL}/flights/my-booking/stats`, {
                headers: {
                    Authorization: req.headers.authorization || '',
                    Cookie: req.headers.cookie || ''
                },
                params: { userId }
            }).catch((err) => {
                console.warn("Booking Service Error:", err.message);
                return { 
                    data: { 
                        data: { 
                            todaysBookings: 0, 
                            monthlyRevenue: 0, 
                            pendingActions: 0 
                        } 
                    } 
                };
            });

            const stats = {
                walletBalance: walletResponse.data?.data?.balance || 0,
                todaysBookings: bookingResponse.data?.data?.todaysBookings || 0,
                monthlyRevenue: bookingResponse.data?.data?.monthlyRevenue || 0,
                pendingActions: bookingResponse.data?.data?.pendingActions || 0,
            };

            console.log(stats)

            res.json({
                success: true,
                data: "hello"
            });

        } catch (error: any) {
            console.error("Dashboard Stats Error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch dashboard statistics"
            });
        }
    }
}