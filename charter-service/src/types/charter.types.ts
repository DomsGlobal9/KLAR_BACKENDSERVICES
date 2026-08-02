export type CharterSource = "b2b" | "b2c";

export interface ICharterBooking {
  from: string;
  to: string;
  departureDateTime: Date;
  passengers: number;
  fullName: string;
  mobileNumber: string;
  email: string;
  source: CharterSource;
  createdAt?: Date;
  updatedAt?: Date;
}