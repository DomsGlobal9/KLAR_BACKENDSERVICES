export type CabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
export type PassengerType = 'ADULT' | 'CHILD' | 'INFANT';
export type FareType = 'REGULAR' | 'STUDENT' | 'SENIOR_CITIZEN';
export type SearchType = 'ONEWAY' | 'RETURN' | 'MULTICITY';

export interface AirportCode {
    code: string;
}

export interface RouteInfo {
    fromCityOrAirport: AirportCode;
    toCityOrAirport: AirportCode;
    travelDate: string;
}

export interface PaxInfo {
    ADULT: number;
    CHILD?: number;
    INFANT?: number;
}

export interface PreferredAirline {
    code: string;
}

export interface SearchModifiers {
    isDirectFlight?: boolean;
    isConnectingFlight?: boolean;
    pft?: FareType;
}

export interface SearchQuery {
    cabinClass: CabinClass;
    paxInfo: PaxInfo;
    routeInfos: RouteInfo[];
    preferredAirline?: PreferredAirline[];
    searchModifiers?: SearchModifiers;
}

export interface ValidationError {
    field: string;
    message: string;
    code?: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    searchType?: SearchType;
    warnings?: ValidationError[];
}