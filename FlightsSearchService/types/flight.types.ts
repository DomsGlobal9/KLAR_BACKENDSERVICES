export interface OneWaySearchDTO {
  from: string;
  to: string;
  departDate: string;
  adults: number;
  children?: number;
  infants?: number;
  cabinClass?: string;
}

export interface ReturnSearchDTO extends OneWaySearchDTO {
  returnDate: string;
}

export interface MultiCitySegment {
  from: string;
  to: string;
  date: string;
}

export interface MultiCitySearchDTO {
  segments: MultiCitySegment[];
  adults: number;
  children?: number;
  infants?: number;
  cabinClass?: string;
}
