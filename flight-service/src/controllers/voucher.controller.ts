import { Request, Response } from "express";
import axios from "axios";
import { envConfig } from "../config";
import { BookingVoucherPdfService } from "../services/bookingVoucherPdf.service";
import BookingService from "../services/bookingLocal.service";
import TripjackBookingService from "../services/booking.service";

class VoucherController {
    private authServiceUrl: string;
    private currentToken: string | null = null;

    constructor() {
        this.authServiceUrl = envConfig.AUTH_SERVICE;
    }

    // *************************************************************************
    // ************************  Private Functions  ****************************
    // *************************************************************************

    private extractToken = (req: Request): string | null => {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            this.currentToken = token;
            return token;
        }

        if (req.cookies?.token) {
            const token = req.cookies.token;
            this.currentToken = token;
            return token;
        }

        return null;
    };

    private validateToken = async (token: string): Promise<any> => {
        try {
            const response = await axios.post(
                `${this.authServiceUrl}/auth/validate-token`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.data.success) {
                const userId = response.data.data.userId ||
                    response.data.data.id ||
                    response.data.data._id;

                if (!userId) {
                    console.error("❌ No user ID found in auth response:", response.data.data);
                    throw new Error("No user ID in token validation response");
                }

                return {
                    id: userId,
                    email: response.data.data.email,
                    roles: response.data.data.roles || ["user"],
                    clientType: response.data.data.clientType || "b2c",
                };
            }

            console.log("❌ TOKEN INVALID - success: false");
            throw new Error("Token validation failed");
        } catch (error: any) {
            console.log("\n🔴 VALIDATION ERROR 🔴");
            console.log("Error message:", error.message);

            if (error.response) {
                console.log("Error Status:", error.response.status);
                console.log("Error Data:", JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                console.log("No response received from Auth Service");
            } else {
                console.log("Error setting up request:", error.message);
            }

            throw new Error(
                error.response?.data?.message ||
                error.message ||
                "Token validation failed"
            );
        }
    };

    // *************************************************************************
    // ************************  Public Functions  ****************************
    // *************************************************************************

    /**
     * Generate and download booking voucher PDF
     * GET /api/voucher/:bookingId/download
     */
    public downloadVoucher = async (req: Request, res: Response) => {
        try {
            console.log("📄 Downloading Voucher - START");
            const { bookingId } = req.params;
            const source = req.query.source as string;

            const bookingIdStr = Array.isArray(bookingId) ? bookingId[0] : bookingId;

            if (!bookingIdStr) {
                return res.status(400).json({
                    success: false,
                    message: "Booking ID is required"
                });
            }

            let localBooking;

            // If source is b2c, get booking without authentication
            if (source === 'b2c') {
                console.log(`📖 Fetching booking ${bookingIdStr} for B2C source`);
                localBooking = await BookingService.getBookingDetailsBySource(
                    bookingIdStr,
                    'b2c'
                );

                if (!localBooking) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found",
                    });
                }
            } else {
                // For authenticated users
                const token = this.extractToken(req);
                if (!token) {
                    return res.status(401).json({
                        success: false,
                        message: "Authorization token missing",
                    });
                }

                const userData = await this.validateToken(token);
                if (!userData?.id) {
                    return res.status(401).json({
                        success: false,
                        message: "Invalid user credentials",
                    });
                }

                localBooking = await BookingService.getBookingDetailsByUser(
                    bookingIdStr,
                    userData.id
                );

                if (!localBooking) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found or unauthorized",
                    });
                }
            }

            // Get booking details from Tripjack
            const tripjackResponse = await TripjackBookingService.getBookingDetails(bookingIdStr);

            // Generate PDF
            const pdfBuffer = await BookingVoucherPdfService.generateFlightVoucherPDF(
                tripjackResponse,
                localBooking
            );

            console.log("✅ Voucher downloaded successfully");

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=voucher-${bookingIdStr}.pdf`);
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);

        } catch (error: any) {
            console.error("❌ Error downloading voucher:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to download voucher",
            });
        }
    };

    /**
     * Preview voucher in browser (inline view)
     * GET /api/voucher/:bookingId/preview
     */
    public previewVoucher = async (req: Request, res: Response) => {
        try {
            console.log("👁️ Previewing Voucher - START");
            const { bookingId } = req.params;

            const bookingIdStr = Array.isArray(bookingId) ? bookingId[0] : bookingId;

            if (!bookingIdStr) {
                return res.status(400).json({
                    success: false,
                    message: "Booking ID is required"
                });
            }

            const token = this.extractToken(req);
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Authorization token missing",
                });
            }

            const userData = await this.validateToken(token);
            if (!userData?.id) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid user credentials",
                });
            }

            const localBooking = await BookingService.getBookingDetails(
                bookingIdStr,
                userData.id
            );

            if (!localBooking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found",
                });
            }

            const tripjackResponse = await TripjackBookingService.getBookingDetails(bookingIdStr);
            const pdfBuffer = await BookingVoucherPdfService.generateFlightVoucherPDF(
                tripjackResponse,
                localBooking
            );

            console.log("✅ Voucher preview generated");

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=voucher-${bookingIdStr}.pdf`);
            res.send(pdfBuffer);

        } catch (error: any) {
            console.error("❌ Error previewing voucher:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to preview voucher",
            });
        }
    };

    /**
     * Get voucher as base64 (for frontend integration)
     * GET /api/voucher/:bookingId/base64
     */
    public getVoucherBase64 = async (req: Request, res: Response) => {
        try {
            console.log("📊 Getting Voucher Base64 - START");
            const { bookingId } = req.params;

            const bookingIdStr = Array.isArray(bookingId) ? bookingId[0] : bookingId;

            if (!bookingIdStr) {
                return res.status(400).json({
                    success: false,
                    message: "Booking ID is required"
                });
            }

            const token = this.extractToken(req);
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Authorization token missing",
                });
            }

            const userData = await this.validateToken(token);
            if (!userData?.id) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid user credentials",
                });
            }

            const localBooking = await BookingService.getBookingDetails(
                bookingIdStr,
                userData.id
            );

            if (!localBooking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found",
                });
            }

            const tripjackResponse = await TripjackBookingService.getBookingDetails(bookingIdStr);
            const pdfBuffer = await BookingVoucherPdfService.generateFlightVoucherPDF(
                tripjackResponse,
                localBooking
            );

            const pdfBase64 = pdfBuffer.toString('base64');

            console.log("✅ Voucher Base64 generated");

            return res.status(200).json({
                success: true,
                data: {
                    bookingId: bookingIdStr,
                    pdfBase64,
                    filename: `voucher-${bookingIdStr}.pdf`,
                    contentType: 'application/pdf',
                    size: pdfBuffer.length
                }
            });

        } catch (error: any) {
            console.error("❌ Error getting voucher base64:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate voucher",
            });
        }
    };

    /**
     * Send voucher via email
     * POST /api/voucher/:bookingId/email
     */
    public emailVoucher = async (req: Request, res: Response) => {
        try {
            console.log("📧 Emailing Voucher - START");
            const { bookingId } = req.params;
            const { email } = req.body;

            const bookingIdStr = Array.isArray(bookingId) ? bookingId[0] : bookingId;

            if (!bookingIdStr) {
                return res.status(400).json({
                    success: false,
                    message: "Booking ID is required"
                });
            }

            const token = this.extractToken(req);
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Authorization token missing",
                });
            }

            const userData = await this.validateToken(token);
            if (!userData?.id) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid user credentials",
                });
            }

            const localBooking = await BookingService.getBookingDetails(
                bookingIdStr,
                userData.id
            );

            if (!localBooking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found",
                });
            }

            const tripjackResponse = await TripjackBookingService.getBookingDetails(bookingIdStr);
            const pdfBuffer = await BookingVoucherPdfService.generateFlightVoucherPDF(
                tripjackResponse,
                localBooking
            );

            const pdfBase64 = pdfBuffer.toString('base64');
            const emailTo = email || localBooking.email;

            await axios.post(`${envConfig.EMAIL_SERVICE}/send-with-attachment`, {
                to: emailTo,
                subject: `Flight Voucher - ${bookingIdStr}`,
                html: `
                    <h2>Your Flight Voucher</h2>
                    <p>Dear ${localBooking.travellers?.[0]?.firstName || 'Customer'},</p>
                    <p>Please find attached your flight voucher for booking: <strong>${bookingIdStr}</strong></p>
                    <p>Thank you for choosing our service!</p>
                    <p>Best regards,<br>Travel Team</p>
                `,
                attachments: [{
                    filename: `voucher-${bookingIdStr}.pdf`,
                    content: pdfBase64,
                    contentType: 'application/pdf'
                }]
            });

            console.log("✅ Voucher emailed successfully");

            return res.status(200).json({
                success: true,
                message: `Voucher sent to ${emailTo}`,
                data: {
                    bookingId: bookingIdStr,
                    sentTo: emailTo
                }
            });

        } catch (error: any) {
            console.error("❌ Error emailing voucher:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to email voucher",
            });
        }
    };
}

export default new VoucherController();