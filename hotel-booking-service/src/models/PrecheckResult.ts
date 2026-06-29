export interface PrecheckResultV1 {
    available: boolean;
    roomType: string;
    mealPlan: string;
    cancellationPolicyHash: string;
    occupancy: number;
    optionId: string;
    price: number;
    taxes: number;
    currency: string;
    phone?: string;
    rateComments?: string;
    paymentType?: string;
    originalResponse?: any;
}

export interface SupplierAdapter {
    precheck(payload: any): Promise<PrecheckResultV1>;
    commit?(payload: any): Promise<any>;
    cancel?(payload: any): Promise<any>;
    pollStatus?(payload: any): Promise<any>;
}
