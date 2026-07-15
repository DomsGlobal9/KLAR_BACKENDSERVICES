import { BookingModel } from '../model/bookingLocal.model';
import { FlightReviewData } from '../model/reviewData.model';
import axios from 'axios';
import { envConfig } from '../config/env.config';

interface CancellationRule {
    amount: number;
    additionalFee: number;
    st: string;
    et: string;
    policyInfo?: string;
    FareComponentsSummary?: any;
}

interface SegmentCancellationInfo {
    segmentId: string;
    airlineCode: string;
    flightNumber: string;
    departureTime: string;
    cancellationFee: number;
    applicableRule: CancellationRule;
}

interface CancellationCalculationResult {
    bookingId: string;
    totalBookingPrice: number;
    totalCancellationFee: number;
    refundAmount: number;
    segmentDetails: SegmentCancellationInfo[];
    isNoShow: boolean;
    noShowTaxes?: number;
    source: 'B2B' | 'B2C';
}

interface FareRuleEntry {
    amount?: number;
    additionalFee?: number;
    policyInfo?: string;
    FareComponentsSummary?: any;
    st?: string;
    et?: string;
}

export class CancellationPriceService {
    private static instance: CancellationPriceService;
    private readonly authServiceUrl: string;
    private readonly internalApiKey: string;

    private constructor() {
        this.authServiceUrl = envConfig.AUTH_SERVICE || '';
        this.internalApiKey = 'DomsGlobal';
    }

    public static getInstance(): CancellationPriceService {
        if (!CancellationPriceService.instance) {
            CancellationPriceService.instance = new CancellationPriceService();
        }
        return CancellationPriceService.instance;
    }

    async calculateCancellationRefund(
        bookingId: string,
        cancellationTime?: Date
    ): Promise<CancellationCalculationResult> {

        const booking = await BookingModel.findOne({ bookingId });
        if (!booking) {
            throw new Error(`Booking with ID ${bookingId} not found`);
        }

        if (booking.totalPrice === undefined || booking.totalPrice === null) {
            throw new Error(`Booking total price is undefined for booking ID ${bookingId}`);
        }

        const source = this.determineBookingSource(booking);

        const review = await FlightReviewData.findOne({
            'mappedData.bookingId': bookingId
        });

        if (!review) {
            throw new Error(`Review data with booking ID ${bookingId} not found`);
        }

        const cancellationDate = cancellationTime || new Date();
        const segmentDetails: SegmentCancellationInfo[] = [];
        let totalCancellationFee = 0;
        let isNoShow = false;
        let noShowTaxes = 0;

        const tripInformation = review.mappedData?.TripInformation;
        
        if (!tripInformation || tripInformation.length === 0) {
            throw new Error('No trip information found in review data');
        }

        for (const tripInfo of tripInformation) {
            const segmentInfo = tripInfo.SegmentInformation;
            const priceList = tripInfo.TotalPriceList;

            if (!segmentInfo || !priceList) continue;

            for (let i = 0; i < segmentInfo.length; i++) {
                const segment = segmentInfo[i];
                const price = priceList[i] || priceList[0];

                if (!price?.fareRuleInformation?.tfr?.CANCELLATION) continue;

                const cancellationRules = price.fareRuleInformation.tfr.CANCELLATION;
                const departureTime = new Date(segment.DepartureTime || '');

                if (isNaN(departureTime.getTime())) {
                    throw new Error(`Invalid departure time for segment ${segment.SegmentID}`);
                }

                const hoursBeforeDeparture = this.getHoursBeforeDeparture(
                    cancellationDate,
                    departureTime
                );

                if (hoursBeforeDeparture < 0) {
                    throw new Error('Cancellation time is after departure time');
                }

                const noShowRule = price.fareRuleInformation.tfr.NO_SHOW;
                if (noShowRule && noShowRule.length > 0 && hoursBeforeDeparture < 4) {
                    isNoShow = true;
                    noShowTaxes = this.extractTaxes(price);
                    continue;
                }

                const applicableRule = this.findApplicableRule(cancellationRules, hoursBeforeDeparture);

                if (!applicableRule) {
                    continue;
                }

                const segmentFee = (applicableRule.amount || 0) + (applicableRule.additionalFee || 0);

                segmentDetails.push({
                    segmentId: segment.SegmentID || `segment_${i}`,
                    airlineCode: segment.FlightDetails?.AirlineInfo?.AirlineCode || '',
                    flightNumber: segment.FlightDetails?.FlightNumber || '',
                    departureTime: segment.DepartureTime || '',
                    cancellationFee: segmentFee,
                    applicableRule: applicableRule
                });

                totalCancellationFee += segmentFee;
            }
        }

        let refundAmount = 0;
        if (isNoShow) {
            refundAmount = Math.max(0, noShowTaxes);
        } else {
            refundAmount = Math.max(0, booking.totalPrice - totalCancellationFee);
        }

        const result: CancellationCalculationResult = {
            bookingId: bookingId,
            totalBookingPrice: booking.totalPrice,
            totalCancellationFee: totalCancellationFee,
            refundAmount: refundAmount,
            segmentDetails: segmentDetails,
            isNoShow: isNoShow,
            noShowTaxes: isNoShow ? noShowTaxes : undefined,
            source: source
        };

        return result;
    }

    async processRefundAndCreditWallet(
        bookingId: string,
        cancellationTime?: Date
    ): Promise<{ refundResult: CancellationCalculationResult; walletCredited: boolean; message: string }> {
        try {
            const result = await this.calculateCancellationRefund(bookingId, cancellationTime);

            if (result.refundAmount <= 0) {
                return {
                    refundResult: result,
                    walletCredited: false,
                    message: 'Refund amount is zero or negative, skipping wallet credit'
                };
            }

            const booking = await BookingModel.findOne({ bookingId });
            if (!booking) {
                throw new Error(`Booking with ID ${bookingId} not found`);
            }

            const userId = booking?.userInfo?.id;
            if (!userId) {
                throw new Error(`User ID not found for booking ${bookingId}`);
            }

            await this.creditWallet(
                userId,
                result.refundAmount,
                'REFUND',
                'WALLET',
                'BOOKING',
                bookingId,
                `Refund for cancelled booking ${bookingId}`
            );

            await BookingModel.updateOne(
                { bookingId: bookingId },
                {
                    refundProcessed: true,
                    refundPrice: result.refundAmount.toString(),
                    refundDate: new Date()
                }
            );

            return {
                refundResult: result,
                walletCredited: true,
                message: `Successfully credited ₹${result.refundAmount} to wallet for booking ${bookingId}`
            };

        } catch (error: any) {
            return {
                refundResult: {} as CancellationCalculationResult,
                walletCredited: false,
                message: `Failed to process refund: ${error.message}`
            };
        }
    }

    public async creditWallet(
        userId: string,
        amount: number,
        type: 'TOP_UP' | 'REFUND',
        paymentMethod: string,
        referenceType?: string,
        referenceId?: string,
        description?: string
    ): Promise<any> {
        try {
            const response = await axios.post(
                `${this.authServiceUrl}/wallet/internal/credit`,
                {
                    userId,
                    amount,
                    type,
                    paymentMethod,
                    referenceType: referenceType || null,
                    referenceId: referenceId || null,
                    description: description || `Wallet ${type.toLowerCase()}`,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-key': this.internalApiKey,
                    },
                }
            );

            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    error.response?.data?.message || 
                    `Failed to credit wallet: ${error.message}`
                );
            }
            throw error;
        }
    }

    private determineBookingSource(booking: any): 'B2B' | 'B2C' {
        const clientType = booking?.userInfo?.clientType?.toLowerCase();
        if (clientType === 'b2b') {
            return 'B2B';
        }
        return 'B2C';
    }

    private getHoursBeforeDeparture(cancellationTime: Date, departureTime: Date): number {
        const diffInMs = departureTime.getTime() - cancellationTime.getTime();
        return diffInMs / (1000 * 60 * 60);
    }

    private findApplicableRule(
        rules: FareRuleEntry[],
        hoursBeforeDeparture: number
    ): CancellationRule | null {
        for (const rule of rules) {
            const startTime = parseInt(rule.st || '0');
            const endTime = parseInt(rule.et || '0');
            if (hoursBeforeDeparture >= startTime && hoursBeforeDeparture < endTime) {
                return {
                    amount: rule.amount || 0,
                    additionalFee: rule.additionalFee || 0,
                    st: rule.st || '0',
                    et: rule.et || '0',
                    policyInfo: rule.policyInfo,
                    FareComponentsSummary: rule.FareComponentsSummary
                };
            }
        }
        return null;
    }

    private extractTaxes(priceList: any): number {
        try {
            const additionalFare = priceList?.FareDetails?.AdultFare?.AdditionalFareComponents?.TotalAdditionalFare;
            if (!additionalFare) return 0;

            const taxes = [
                additionalFare.ManagementFeeTax || 0,
                additionalFare.OtherTaxes || 0,
                additionalFare.AirlineGSTComponent || 0
            ];

            return taxes.reduce((sum: number, tax: number) => sum + tax, 0);
        } catch {
            return 0;
        }
    }

    async calculatePartialCancellation(
        bookingId: string,
        segmentIds: string[],
        cancellationTime?: Date
    ): Promise<CancellationCalculationResult> {
        const booking = await BookingModel.findOne({ bookingId });
        if (!booking) {
            throw new Error(`Booking with ID ${bookingId} not found`);
        }

        if (booking.totalPrice === undefined || booking.totalPrice === null) {
            throw new Error(`Booking total price is undefined for booking ID ${bookingId}`);
        }

        const source = this.determineBookingSource(booking);

        const review = await FlightReviewData.findOne({
            'mappedData.bookingId': bookingId
        });
        if (!review) {
            throw new Error(`Review data with booking ID ${bookingId} not found`);
        }

        const cancellationDate = cancellationTime || new Date();
        const segmentDetails: SegmentCancellationInfo[] = [];
        let totalCancellationFee = 0;
        let isNoShow = false;
        let noShowTaxes = 0;

        const tripInformation = review.mappedData?.TripInformation;
        if (!tripInformation) {
            throw new Error('No trip information found in review data');
        }

        let totalSegments = 0;
        let cancellingSegments = 0;

        for (const tripInfo of tripInformation) {
            const segmentInfo = tripInfo.SegmentInformation;
            if (segmentInfo) {
                totalSegments += segmentInfo.length;
            }
        }

        cancellingSegments = segmentIds.length;

        if (totalSegments === 0) {
            throw new Error('No segments found in trip information');
        }

        for (const tripInfo of tripInformation) {
            const segmentInfo = tripInfo.SegmentInformation;
            const priceList = tripInfo.TotalPriceList;

            if (!segmentInfo || !priceList) continue;

            for (let i = 0; i < segmentInfo.length; i++) {
                const segment = segmentInfo[i];
                const price = priceList[i] || priceList[0];

                if (!segmentIds.includes(segment.SegmentID || '')) continue;

                if (!price?.fareRuleInformation?.tfr?.CANCELLATION) continue;

                const cancellationRules = price.fareRuleInformation.tfr.CANCELLATION;
                const departureTime = new Date(segment.DepartureTime || '');

                if (isNaN(departureTime.getTime())) {
                    throw new Error(`Invalid departure time for segment ${segment.SegmentID}`);
                }

                const hoursBeforeDeparture = this.getHoursBeforeDeparture(
                    cancellationDate,
                    departureTime
                );

                if (hoursBeforeDeparture < 0) {
                    throw new Error('Cancellation time is after departure time');
                }

                const noShowRule = price.fareRuleInformation.tfr.NO_SHOW;
                if (noShowRule && noShowRule.length > 0 && hoursBeforeDeparture < 4) {
                    isNoShow = true;
                    noShowTaxes = this.extractTaxes(price);
                    continue;
                }

                const applicableRule = this.findApplicableRule(cancellationRules, hoursBeforeDeparture);

                if (!applicableRule) {
                    continue;
                }

                const segmentFee = (applicableRule.amount || 0) + (applicableRule.additionalFee || 0);

                segmentDetails.push({
                    segmentId: segment.SegmentID || `segment_${i}`,
                    airlineCode: segment.FlightDetails?.AirlineInfo?.AirlineCode || '',
                    flightNumber: segment.FlightDetails?.FlightNumber || '',
                    departureTime: segment.DepartureTime || '',
                    cancellationFee: segmentFee,
                    applicableRule: applicableRule
                });

                totalCancellationFee += segmentFee;
            }
        }

        let refundAmount = 0;
        if (isNoShow) {
            refundAmount = Math.max(0, noShowTaxes);
        } else {
            const proportionalPrice = (booking.totalPrice / totalSegments) * cancellingSegments;
            refundAmount = Math.max(0, proportionalPrice - totalCancellationFee);
        }

        const result: CancellationCalculationResult = {
            bookingId: bookingId,
            totalBookingPrice: booking.totalPrice,
            totalCancellationFee: totalCancellationFee,
            refundAmount: refundAmount,
            segmentDetails: segmentDetails,
            isNoShow: isNoShow,
            noShowTaxes: isNoShow ? noShowTaxes : undefined,
            source: source
        };

        return result;
    }

    async calculateCancellationByTimeWindow(
        bookingId: string,
        hoursBeforeDeparture: number
    ): Promise<CancellationCalculationResult> {
        const booking = await BookingModel.findOne({ bookingId });
        if (!booking) {
            throw new Error(`Booking with ID ${bookingId} not found`);
        }

        if (booking.totalPrice === undefined || booking.totalPrice === null) {
            throw new Error(`Booking total price is undefined for booking ID ${bookingId}`);
        }

        const source = this.determineBookingSource(booking);

        const review = await FlightReviewData.findOne({
            'mappedData.bookingId': bookingId
        });
        if (!review) {
            throw new Error(`Review data with booking ID ${bookingId} not found`);
        }

        const segmentDetails: SegmentCancellationInfo[] = [];
        let totalCancellationFee = 0;
        let isNoShow = false;
        let noShowTaxes = 0;

        const tripInformation = review.mappedData?.TripInformation;
        if (!tripInformation) {
            throw new Error('No trip information found in review data');
        }

        for (const tripInfo of tripInformation) {
            const segmentInfo = tripInfo.SegmentInformation;
            const priceList = tripInfo.TotalPriceList;

            if (!segmentInfo || !priceList) continue;

            for (let i = 0; i < segmentInfo.length; i++) {
                const segment = segmentInfo[i];
                const price = priceList[i] || priceList[0];

                if (!price?.fareRuleInformation?.tfr?.CANCELLATION) continue;

                const cancellationRules = price.fareRuleInformation.tfr.CANCELLATION;
                const departureTime = new Date(segment.DepartureTime || '');

                if (isNaN(departureTime.getTime())) {
                    throw new Error(`Invalid departure time for segment ${segment.SegmentID}`);
                }

                const noShowRule = price.fareRuleInformation.tfr.NO_SHOW;
                if (noShowRule && noShowRule.length > 0 && hoursBeforeDeparture < 4) {
                    isNoShow = true;
                    noShowTaxes = this.extractTaxes(price);
                    continue;
                }

                const applicableRule = this.findApplicableRule(cancellationRules, hoursBeforeDeparture);

                if (!applicableRule) {
                    continue;
                }

                const segmentFee = (applicableRule.amount || 0) + (applicableRule.additionalFee || 0);

                segmentDetails.push({
                    segmentId: segment.SegmentID || `segment_${i}`,
                    airlineCode: segment.FlightDetails?.AirlineInfo?.AirlineCode || '',
                    flightNumber: segment.FlightDetails?.FlightNumber || '',
                    departureTime: segment.DepartureTime || '',
                    cancellationFee: segmentFee,
                    applicableRule: applicableRule
                });

                totalCancellationFee += segmentFee;
            }
        }

        let refundAmount = 0;
        if (isNoShow) {
            refundAmount = Math.max(0, noShowTaxes);
        } else {
            refundAmount = Math.max(0, booking.totalPrice - totalCancellationFee);
        }

        const result: CancellationCalculationResult = {
            bookingId: bookingId,
            totalBookingPrice: booking.totalPrice,
            totalCancellationFee: totalCancellationFee,
            refundAmount: refundAmount,
            segmentDetails: segmentDetails,
            isNoShow: isNoShow,
            noShowTaxes: isNoShow ? noShowTaxes : undefined,
            source: source
        };

        return result;
    }
}

export const cancellationPriceService = CancellationPriceService.getInstance();