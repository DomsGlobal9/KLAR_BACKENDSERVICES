export interface PrecheckResultV1 {
  available: boolean;
  roomType: string;
  mealPlan: string;
  cancellationPolicyHash: string;
  occupancy: number;
  optionId: string;
  price: number; // api net (INCLUDES platform markup) — validated against what the agent saw
  taxes: number;
  supplierNet?: number; // raw amount to pay the supplier (EXCLUDES platform markup)
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
