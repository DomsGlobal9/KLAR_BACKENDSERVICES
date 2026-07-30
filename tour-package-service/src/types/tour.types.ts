export enum DestinationType {
  DOMESTIC = "Domestic Travel",
  INTERNATIONAL = "International Travel",
}

export enum PortalSource {
  B2B = "B2B",
  B2C = "B2C",
}

export interface ITourQuery {
  destinationType: DestinationType;
  fullName: string;
  contactNumber: string;
  email: string;
  destinationName: string;
  travelDate: Date;
  numberOfTravellers: number;
  specialRequirements?: string;
  source: PortalSource;
  createdAt?: Date;
  updatedAt?: Date;
}