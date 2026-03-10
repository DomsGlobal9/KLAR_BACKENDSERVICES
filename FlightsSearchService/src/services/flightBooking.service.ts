import { Types } from 'mongoose';
import { FlightBookingRepository } from '../repositories/flightBooking.repository';
import { IFlightBooking, BookingStatus, PassengerType, Title } from '../models/flightBooking.model';
import { CreateFlightBookingDTO, UpdateBookingStatusDTO } from '../interface/flight/flightBooking.interface';


export class FlightBookingService {
    private repository: FlightBookingRepository;

    constructor() {
        this.repository = new FlightBookingRepository();
    }

    async createBooking(data: CreateFlightBookingDTO): Promise<IFlightBooking> {

        const existingBooking = await this.repository.findByBookingId(data.bookingId);

        if (existingBooking) {
            throw new Error(`Booking with ID ${data.bookingId} already exists`);
        }

        const travellerInfo = data.travellerInfo.map(traveller => ({
            ti: traveller.ti,
            fN: traveller.fN,
            lN: traveller.lN,
            pt: traveller.pt,
            dob: new Date(traveller.dob),
            pNat: traveller.pNat,
            pNum: traveller.pNum,
            eD: traveller.eD ? new Date(traveller.eD) : undefined,
            pid: traveller.pid ? new Date(traveller.pid) : undefined,
            di: traveller.di,
            ssrBaggageInfos: traveller.ssrBaggageInfos,
            ssrMealInfos: traveller.ssrMealInfos,
            ssrSeatInfos: traveller.ssrSeatInfos,
            ssrExtraServiceInfos: traveller.ssrExtraServiceInfos
        }));

        const bookingData: Partial<IFlightBooking> = {
            bookingId: data.bookingId,
            userId: data.userId,
            paymentInfos: data.paymentInfos,
            travellerInfo: travellerInfo as any, 
            gstInfo: data.gstInfo,
            deliveryInfo: data.deliveryInfo,
            contactInfo: data.contactInfo,
            totalAmount: data.totalAmount,
            priceIds: data.priceIds,
            tripDetails: data.tripDetails,
            bookingDate: new Date(),
            status: BookingStatus.PENDING
        };

        return await this.repository.create(bookingData);
    }

    async getBookingById(id: string): Promise<IFlightBooking | null> {
        if (!Types.ObjectId.isValid(id)) {
            throw new Error('Invalid booking ID format');
        }
        return await this.repository.findById(id);
    }

    async getBookingByBookingId(bookingId: string): Promise<IFlightBooking | null> {
        return await this.repository.findByBookingId(bookingId);
    }

    async getUserBookings(userId: string, page: number = 1, limit: number = 10): Promise<{ data: IFlightBooking[]; total: number }> {
        return await this.repository.findByUserId(userId, page, limit);
    }

    async updateBookingStatus(id: string, data: UpdateBookingStatusDTO): Promise<IFlightBooking | null> {
        if (!Types.ObjectId.isValid(id)) {
            throw new Error('Invalid booking ID format');
        }

        const updateData: Partial<IFlightBooking> = {
            status: data.status,
            ...(data.failureReason && { failureReason: data.failureReason })
        };

        return await this.repository.updateStatus(id, data.status, updateData);
    }

    async confirmBooking(bookingId: string): Promise<IFlightBooking | null> {
        const booking = await this.repository.findByBookingId(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        return await this.repository.updateStatus(
            booking._id.toString(), 
            BookingStatus.CONFIRMED
        );
    }

    async cancelBooking(bookingId: string, reason?: string): Promise<IFlightBooking | null> {
        const booking = await this.repository.findByBookingId(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        return await this.repository.updateStatus(
            booking._id.toString(), 
            BookingStatus.CANCELLED,
            { failureReason: reason }
        );
    }

    async failBooking(bookingId: string, reason: string): Promise<IFlightBooking | null> {
        const booking = await this.repository.findByBookingId(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        return await this.repository.updateStatus(
            booking._id.toString(), 
            BookingStatus.FAILED,
            { failureReason: reason }
        );
    }

    async getBookingStats(userId?: string): Promise<any> {
        return await this.repository.getBookingStats(userId);
    }

    async validateBookingData(data: CreateFlightBookingDTO): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];


        if (!data.bookingId) {
            errors.push('Booking ID is required');
        }


        if (!data.paymentInfos || data.paymentInfos.length === 0) {
            errors.push('Payment information is required');
        } else {
            const totalAmount = data.paymentInfos.reduce((sum, p) => sum + p.amount, 0);
            if (totalAmount !== data.totalAmount) {
                errors.push('Total amount mismatch with payment infos');
            }
        }


        if (!data.travellerInfo || data.travellerInfo.length === 0) {
            errors.push('Traveller information is required');
        } else {

            const hasAdult = data.travellerInfo.some(t => t.pt === PassengerType.ADULT);
            if (!hasAdult) {
                errors.push('At least one adult passenger is required');
            }


            const adultCount = data.travellerInfo.filter(t => t.pt === PassengerType.ADULT).length;
            const infantCount = data.travellerInfo.filter(t => t.pt === PassengerType.INFANT).length;
            if (infantCount > adultCount) {
                errors.push('Number of infants cannot exceed number of adults');
            }


            const childCount = data.travellerInfo.filter(t => t.pt === PassengerType.CHILD).length;
            if (childCount > adultCount) {
                errors.push('Number of children cannot exceed number of adults');
            }


            const totalPassengers = data.travellerInfo.length;
            if (totalPassengers > 9) {
                errors.push('Total passengers cannot exceed 9');
            }


            data.travellerInfo.forEach((traveller, index) => {
                if (!traveller.ti) errors.push(`Traveller ${index + 1}: Title is required`);
                if (!traveller.fN) errors.push(`Traveller ${index + 1}: First name is required`);
                if (!traveller.lN) errors.push(`Traveller ${index + 1}: Last name is required`);
                if (!traveller.dob) errors.push(`Traveller ${index + 1}: Date of birth is required`);
            });
        }


        if (!data.deliveryInfo) {
            errors.push('Delivery information is required');
        } else {
            if (!data.deliveryInfo.emails || data.deliveryInfo.emails.length === 0) {
                errors.push('At least one email is required for delivery');
            }
            if (!data.deliveryInfo.contacts || data.deliveryInfo.contacts.length === 0) {
                errors.push('At least one contact number is required for delivery');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}