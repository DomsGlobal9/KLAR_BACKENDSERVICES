import { Types } from "mongoose";

// ======================
// MARKUP TYPES
// ======================

export interface IMarkup {
    _id?: Types.ObjectId;
    userId: Types.ObjectId;
    serviceType: ServiceType;
    
    percentageMarkup: number;
    fixedMarkup: number;
    
    appliedTo: MarkupAppliedTo;
    isActive: boolean;
    
    rules?: MarkupRules;
    
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

// Enums
export enum ServiceType {
    FLIGHT = "FLIGHT",
    HOTEL = "HOTEL",
    VISA = "VISA",
    INSURANCE = "INSURANCE",
    ALL = "ALL"
}

export enum MarkupAppliedTo {
    BASE_FARE = "BASE_FARE",
    TOTAL_FARE = "TOTAL_FARE"
}

// Advanced Rules
export interface MarkupRules {
    airlines?: string[];           // e.g., ["AI", "UK", "SG"]
    hotelChains?: string[];
    minimumAmount?: number;
    maximumMarkup?: number;        // Cap on markup amount
    excludedDates?: Date[];
}

// Request DTOs
export interface UpsertMarkupRequest {
    serviceType: ServiceType;
    percentageMarkup?: number;
    fixedMarkup?: number;
    appliedTo?: MarkupAppliedTo;
    rules?: MarkupRules;
    isActive?: boolean;
}

export interface CalculateMarkupRequest {
    baseAmount: number;
    serviceType: ServiceType;
}

// Response DTOs
export interface MarkupResponse {
    id: string;
    serviceType: ServiceType;
    percentageMarkup: number;
    fixedMarkup: number;
    appliedTo: MarkupAppliedTo;
    isActive: boolean;
    rules?: MarkupRules;
}

export interface PriceCalculationResponse {
    baseAmount: number;
    markupAmount: number;
    totalAmount: number;
    markupConfig: {
        percentage: number;
        fixed: number;
        appliedTo: MarkupAppliedTo;
    };
}

