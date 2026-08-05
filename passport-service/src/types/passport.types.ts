export interface IPassportQuote {
  source: "b2b" | "b2c";
  service: "New passport" | "Renewal" | "Reissue" | "Police Clearance Certificate";
  applicant: "Adult" | "Minor";
  city: string;
  fullName: string;
  mobileNumber: string;
  emailId: string;
  createdAt?: Date;
  updatedAt?: Date;
}