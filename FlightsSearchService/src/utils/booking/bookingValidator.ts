import { ValidationResult } from "../../interface/flight/booking.interface";
import { UserFriendlyBookingRequest } from "./bookingMapper";


export class BookingValidator {

    /**
     * Main validation method
     */
    static validate(userRequest: UserFriendlyBookingRequest): ValidationResult {
        const errors: string[] = [];

        this.validateRequiredFields(userRequest, errors);

        this.validateTravellers(userRequest.travellers, errors);

        this.validateEmails(userRequest, errors);

        this.validatePhones(userRequest, errors);

        if (userRequest.gst) {
            this.validateGST(userRequest.gst, errors);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate required fields
     */
    private static validateRequiredFields(
        userRequest: UserFriendlyBookingRequest,
        errors: string[]
    ): void {
        const requiredFields = [
            { field: userRequest.bookingId, message: "Booking ID is required" },
            { field: userRequest.totalAmount, message: "Total amount is required" },
            { field: userRequest.deliveryEmail, message: "Delivery email is required" },
            { field: userRequest.deliveryPhone, message: "Delivery phone is required" }
        ];

        requiredFields.forEach(({ field, message }) => {
            if (!field) errors.push(message);
        });
    }

    /**
     * Validate all travellers
     */
    private static validateTravellers(travellers: any[], errors: string[]): void {
        if (!travellers?.length) {
            errors.push("At least one traveller is required");
            return;
        }

        travellers.forEach((traveller, index) => {
            this.validateSingleTraveller(traveller, index + 1, errors);
        });

        const infantsWithoutDob = travellers.filter(
            t => t.type === 'infant' && !t.dateOfBirth
        );
        if (infantsWithoutDob.length > 0) {
            errors.push("Date of birth is required for all infants");
        }
    }

    /**
     * Validate a single traveller
     */
    private static validateSingleTraveller(
        traveller: any,
        index: number,
        errors: string[]
    ): void {
        const prefix = `Traveller ${index}: `;

        if (!traveller.type) {
            errors.push(`${prefix}Traveller type is required`);
        } else if (!['adult', 'child', 'infant'].includes(traveller.type)) {
            errors.push(`${prefix}Invalid traveller type. Must be 'adult', 'child', or 'infant'`);
        }

        if (!traveller.title) {
            errors.push(`${prefix}Title is required`);
        } else if (!['Mr', 'Mrs', 'Ms', 'Master'].includes(traveller.title)) {
            errors.push(`${prefix}Invalid title. Must be Mr, Mrs, Ms, or Master`);
        }

        if (!traveller.firstName?.trim()) {
            errors.push(`${prefix}First name is required`);
        }

        if (!traveller.lastName?.trim()) {
            errors.push(`${prefix}Last name is required`);
        }

        if (traveller.dateOfBirth && !this.isValidDate(traveller.dateOfBirth)) {
            errors.push(`${prefix}Invalid date of birth format. Use YYYY-MM-DD`);
        }

        this.validatePassportDetails(traveller, prefix, errors);
    }

    /**
     * Validate passport details
     */
    private static validatePassportDetails(
        traveller: any,
        prefix: string,
        errors: string[]
    ): void {
        const hasPassportField = traveller.passportNumber ||
            traveller.passportExpiryDate ||
            traveller.passportNationality ||
            traveller.passportIssueDate;

        if (!hasPassportField) return;

        if (!traveller.passportNumber) {
            errors.push(`${prefix}Passport number is required when providing passport details`);
        }

        if (!traveller.passportExpiryDate) {
            errors.push(`${prefix}Passport expiry date is required when providing passport details`);
        } else if (!this.isValidDate(traveller.passportExpiryDate)) {
            errors.push(`${prefix}Invalid passport expiry date format`);
        }

        if (!traveller.passportNationality) {
            errors.push(`${prefix}Passport nationality is required when providing passport details`);
        } else if (traveller.passportNationality.length !== 2) {
            errors.push(`${prefix}Passport nationality must be 2-letter IATA code`);
        }
    }

    /**
     * Validate all emails
     */
    private static validateEmails(
        userRequest: UserFriendlyBookingRequest,
        errors: string[]
    ): void {
        if (userRequest.deliveryEmail && !this.isValidEmail(userRequest.deliveryEmail)) {
            errors.push("Invalid delivery email format");
        }

        if (userRequest.emergencyContact?.email &&
            !this.isValidEmail(userRequest.emergencyContact.email)) {
            errors.push("Invalid emergency contact email format");
        }

        if (userRequest.gst?.email && !this.isValidEmail(userRequest.gst.email)) {
            errors.push("Invalid GST email format");
        }
    }

    /**
     * Validate all phone numbers
     */
    private static validatePhones(
        userRequest: UserFriendlyBookingRequest,
        errors: string[]
    ): void {
        const phoneRegex = /^\+?[0-9]{10,15}$/;

        if (userRequest.deliveryPhone &&
            !phoneRegex.test(userRequest.deliveryPhone.replace(/\s/g, ''))) {
            errors.push("Invalid delivery phone format");
        }

        if (userRequest.emergencyContact?.phone &&
            !phoneRegex.test(userRequest.emergencyContact.phone.replace(/\s/g, ''))) {
            errors.push("Invalid emergency contact phone format");
        }

        if (userRequest.gst?.phone &&
            !phoneRegex.test(userRequest.gst.phone.replace(/\s/g, ''))) {
            errors.push("Invalid GST phone format");
        }
    }

    /**
     * Validate GST details
     */
    private static validateGST(gst: any, errors: string[]): void {
        if (!gst.number) {
            errors.push("GST number is required when GST info is provided");
        } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst.number)) {
            errors.push("Invalid GST number format");
        }

        if (!gst.registeredName) {
            errors.push("GST registered name is required");
        } else if (gst.registeredName.length > 35) {
            errors.push("GST registered name must be max 35 characters");
        }

        if (gst.address && gst.address.length > 70) {
            errors.push("GST address must be max 70 characters");
        }
    }

    /**
     * Email format validator
     */
    private static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Date format validator (YYYY-MM-DD)
     */
    private static isValidDate(date: string): boolean {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) return false;

        const d = new Date(date);
        return d instanceof Date && !isNaN(d.getTime());
    }
}