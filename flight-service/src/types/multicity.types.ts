export type MulticitySourceType = "TRIPJACK_COMBO" | "TRIPJACK_ROUTE";

export type MulticityMode = "DOMESTIC" | "INTERNATIONAL";

export type MulticitySelectionMode = "PER_ROUTE" | "COMBINED";

export interface MulticityRoute {
    routeIndex: number;
    from: string;
    to: string;
    travelDate: string;
}

export interface MulticityDisplayLeg {
    legIndex: number;
    segmentIds: string[];
    flightKey: string;
    from: string;
    to: string;
}

export interface MulticityOptionFare {
    priceId: string;
    fareIdentifier: string | null;
    totalPrice: number;
}

export interface MulticityOption {
    optionId: string;
    sourceType: MulticitySourceType;
    sourceIndex: number;
    routeIndex: number | null;
    fares: MulticityOptionFare[];
    priceIds: string[];
    defaultPriceId: string | null;
    legs: MulticityDisplayLeg[];
    diagnostics: string[];
}

export interface MulticityRejection {
    sourceType: MulticitySourceType;
    sourceIndex: number;
    reason: string;
}

export interface MulticitySelectionIndex {
    mode: MulticityMode;
    selectionMode: MulticitySelectionMode;
    routes: MulticityRoute[];
    options: MulticityOption[];
    unmappable: MulticityRejection[];
}

export interface MulticitySelectionRequest {
    optionId: string;
    priceId?: string;
}

export class MulticitySelectionError extends Error {
    statusCode: number;
    errorCode: string;
    details?: unknown;

    constructor(message: string, errorCode: string, details?: unknown) {
        super(message);
        this.name = "MulticitySelectionError";
        this.statusCode = 400;
        this.errorCode = errorCode;
        this.details = details;
    }
}
