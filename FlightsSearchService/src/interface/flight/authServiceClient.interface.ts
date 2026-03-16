export interface ValidatedUser {
    userId: string;
    email: string;
    clientType: string;
    roles: string[];
    companyName: string | null;
    businessName: string | null;
    gstNumber: string | null;
    phoneNumber: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
    status: string;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface TokenValidationResponse {
    success: boolean;
    message: string;
    data: ValidatedUser;
}