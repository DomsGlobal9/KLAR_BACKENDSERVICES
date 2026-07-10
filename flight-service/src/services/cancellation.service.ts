import axios from "axios";
import { TRIPJACK_URLS, tripjackConfig } from "../config";
import { BookingRepository } from "../repositories/bookingLocal.repository";
import { envConfig } from "../config/env.config";
import { cancellationRequestTemplate } from "../templates/flight-client-cancellation.template";
import { cancellationRequestAgencyTemplate } from "../templates/flight-agency-cancellation.template";

class CancellationService {

    private bookingRepo = new BookingRepository();

    private getConfig() {
        const env = tripjackConfig.ENV;
        const config = TRIPJACK_URLS[env];

        return {
            baseUrl: config.BASE_URL,
            headers: {
                "Content-Type": "application/json",
                apikey: tripjackConfig.API_KEY,
            },
            endpoints: config,
        };
    }

    async getCharges(payload: any) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        try {
            const response = await axios.post(
                `${baseUrl}${endpoints.AMENDMENT_CHARGES}`,
                payload,
                { headers }
            );

            return response.data;
        } catch (error: any) {

            const apiError = error.response?.data;

            console.error("Get Charges ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(apiError, null, 2),
                message: error.message
            });

            throw {
                success: false,
                httpStatus: error.response?.status || 500,
                error: apiError?.errors?.[0] || null,
                raw: apiError
            };
        }
    }

    async submit(payload: any) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        try {
            const response = await axios.post(
                `${baseUrl}${endpoints.SUBMIT_AMENDMENT}`,
                payload,
                { headers }
            );

            const amendmentId = response.data?.amendmentId;

            if (amendmentId) {
                await this.bookingRepo.updateBooking(payload.bookingId, {
                    amendmentId,
                    status: "CANCEL_REQUESTED",
                });
            }

            const ourDbBookingData = await this.bookingRepo.getBookingById(payload.bookingId);

            await this.sendCancellationRequestEmail(ourDbBookingData);

            return response;

        } catch (error: any) {
            console.error("Submit Amendment ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    async status(amendmentId: string) {
        const { baseUrl, headers, endpoints } = this.getConfig();

        try {
            const response = await axios.post(
                `${baseUrl}${endpoints.AMENDMENT_DETAILS}`,
                { amendmentId },
                { headers }
            );

            const status = response.data?.status;
            const bookingId = response.data?.bookingId;

            if (status === "SUCCESS") {
                await this.bookingRepo.updateBookingStatus(
                    bookingId,
                    "CANCELLED"
                );
            }

            if (status === "REJECTED") {
                await this.bookingRepo.updateBookingStatus(
                    bookingId,
                    "CONFIRMED"
                );
            }

            return response;

        } catch (error: any) {
            console.error("Amendment Status ERROR >>>", {
                status: error.response?.status,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });

            throw error;
        }
    }

    // ##################
    // PRIVATE Functions
    // ##################
    private async sendCancellationRequestEmail(booking: any) {
        try {
            if (!booking) return;

            const travellerEmail = booking?.email || "";
            const agentEmail = booking?.userInfo?.email || "";

            const templateData = {
                bookingId: booking?.bookingId || '',
                status: 'CANCELLATION REQUESTED',
                totalPrice: booking?.totalPrice || 0,
                markupPrice: booking?.markupPrice || 0,
                tripjackPrice: booking?.tripjackPrice || 0,
                travellers: booking?.travellers || [],
                email: booking?.email || '',
                phone: booking?.phone || '',
                gstInfo: booking?.gstInfo || null,
                emergencyContact: booking?.emergencyContact || null,
                userInfo: booking?.userInfo || {},
                cancellationDate: new Date().toISOString(),
            };

            const clientTemplate = Handlebars.compile(cancellationRequestTemplate, {
                strict: false,
                assumeObjects: true
            });

            const agencyTemplate = Handlebars.compile(cancellationRequestAgencyTemplate, {
                strict: false,
                assumeObjects: true
            });

            if (travellerEmail) {
                await this.sendEmail(
                    travellerEmail,
                    `Flight Cancellation Request - ${booking?.bookingId}`,
                    clientTemplate(templateData)
                );
                console.log(`✅ [Cancellation] Email sent to traveller: ${travellerEmail}`);
            }

            if (agentEmail && agentEmail !== travellerEmail) {
                await this.sendEmail(
                    agentEmail,
                    `Flight Cancellation Request - ${booking?.bookingId} (Agency Copy)`,
                    agencyTemplate(templateData)
                );
                console.log(`✅ [Cancellation] Email sent to agent: ${agentEmail}`);
            }

        } catch (error) {
            console.error(`[Cancellation] Email failed for ${booking?.bookingId}:`, error);
        }
    }

    private async sendEmail(
        to: string,
        subject: string,
        html: string
    ) {
        try {
            await axios.post(`${envConfig.EMAIL_SERVICE}/send`, {
                to,
                subject,
                html
            });
        } catch (error: any) {
            // Email send failed silently
        }
    }

}

export default new CancellationService();