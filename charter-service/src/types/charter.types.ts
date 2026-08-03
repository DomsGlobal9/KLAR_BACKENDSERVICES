export type CharterSource = "b2b" | "b2c";

export type CharterCategory =
  | "Private Jets"
  | "Helicopter Charter"
  | "Corporate Charter"
  | "Group Charter";

export interface ICharterBooking {
  from: string;
  to: string;
  departureDateTime: Date;
  passengers: number;
  category: CharterCategory;
  fullName: string;
  mobileNumber: string;
  email: string;
  source: CharterSource;
  createdAt?: Date;
  updatedAt?: Date;
}