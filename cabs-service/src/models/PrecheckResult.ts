import { CabPolicies } from "./tripjack.types";

/**
 * Normalised result of a pre-booking price/availability check for a single
 * selected cab. Every supplier adapter maps its raw quote response into this
 * shape so the ValidationEngine and booking service stay supplier-agnostic.
 *
 * Cabs equivalent of hotel-booking-service's PrecheckResultV1.
 */
export interface CabPrecheckResultV1 {
  available: boolean;

  // Identity of the offered vehicle (used to detect a supplier swap at book time).
  vehicleType: string;
  vehicleCategory: string;

  // FRESH supplier identifiers — the booking must commit with these, not the
  // (possibly expired) ids the frontend sent. Mirrors hotel's fresh optionId.
  quotationId: string;
  quoteChildId: string;
  vendorId: number;

  // Fresh fare from the supplier at check time.
  price: number; // total fare EXCLUDING tax (net)
  taxes: number; // total tax
  currency: string;

  paxCount: number;
  luggageCount: number;

  // sha256 of the cancellation policy, to detect a policy change since search.
  cancellationPolicyHash: string;
  policies?: CabPolicies;

  originalResponse?: any;
}

/**
 * The uniform contract every cab supplier must implement. Only `precheck` is
 * required today; `commit`/`cancel`/`pollStatus` are optional so a read-only
 * supplier can register without them.
 */
export interface SupplierAdapter {
  precheck(payload: any): Promise<CabPrecheckResultV1>;
  commit?(payload: any): Promise<any>;
  cancel?(payload: any): Promise<any>;
  pollStatus?(payload: any): Promise<any>;
}
