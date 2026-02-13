export type PrimarySortType = 'CHEAPEST' | 'QUICKEST';
export type SecondarySortType = 'EARLY_DEPARTURE' | 'EARLY_ARRIVAL' | 'NONE';

export interface SortOptions {
    primary: PrimarySortType;
    secondary: SecondarySortType;
}

export interface SortResult<T> {
    sortedData: T[];
    appliedSort: SortOptions;
}