// export interface IIndividualVisa {
//   fullName: string;
//   mobileNumber: string;
//   email: string;
//   currentCity: string;
//   country: string;

//   destinationCountry: string;
//   travelDate: string;
//   purpose: string;

//   employmentStatus: string;
//   travelHistory: string;

//   visaType: "INDIVIDUAL";
// }

export interface IVisa {
  fullName: string;
  mobileNumber: string;
  email: string;

  destinationCountry: string;
  travelDate: string;

  // Individual
  currentCity?: string;
  country?: string;
  purpose?: string;
  employmentStatus?: string;
  travelHistory?: string;

  // Family / Group
  numAdults?: string;
  numChildren?: string;
  holdValidPassports?: string;
  previousRefusals?: string;

   // Business fields
  applicantName?: string;
  companyName?: string;
  designation?: string;
  businessEmail?: string;
  contactNumber?: string;

  destinationCountry?: string;
  purpose?: string;
  travelDate?: string;

  invitationLetter?: string;
  previousTravelHistory?: string;

  // Student / Conference
visaSubType?: string;
intakeDate?: string;
admissionLetter?: string;
sponsorDetails?: string;

// Others
employmentStatus?: string;
travelHistory?: string;

   visaType: "INDIVIDUAL" | "FAMILY" | "BUSINESS" | "STUDENT" | "OTHERS";
}