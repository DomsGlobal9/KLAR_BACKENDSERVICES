// import mongoose, { Schema, Document } from "mongoose";

// export interface IVisaDocument extends Document {
//   fullName: string;
//   mobileNumber: string;
//   email: string;

//   destinationCountry: string;
//   travelDate: string;

//   currentCity?: string;
//   country?: string;
//   purpose?: string;
//   employmentStatus?: string;
//   travelHistory?: string;

//   numAdults?: string;
//   numChildren?: string;
//   holdValidPassports?: string;
//   previousRefusals?: string;

//   visaType: string;
// }

// const VisaSchema: Schema = new Schema(
//   {
//     fullName: { type: String, required: true },
//     mobileNumber: { type: String, required: true },
//     email: { type: String, required: true },

//     destinationCountry: { type: String, required: true },
//     travelDate: { type: String, required: true },

//     // Individual
//     currentCity: String,
//     country: String,
//     purpose: String,
//     employmentStatus: String,
//     travelHistory: String,

//     // Family
//     numAdults: String,
//     numChildren: String,
//     holdValidPassports: String,
//     previousRefusals: String,

//     visaType: {
//       type: String,
//       enum: ["INDIVIDUAL", "FAMILY"],
//       required: true,
//     },
//   },
//   { timestamps: true }
// );

// export default mongoose.model<IVisaDocument>("Visa", VisaSchema);


import mongoose, { Schema } from "mongoose";

const visaSchema = new Schema(
  {
    visaType: {
      type: String,
      required: true,
    },

    // Individual
    fullName: String,
    mobileNumber: String,
    email: String,
    currentCity: String,
    country: String,

    // Family
    numAdults: String,
    numChildren: String,
    holdValidPassports: String,
    previousRefusals: String,

    // Business
    applicantName: String,
    companyName: String,
    designation: String,
    businessEmail: String,
    contactNumber: String,

    // Common
    destinationCountry: String,
    travelDate: String,
    purpose: String,

    // Business extra
    invitationLetter: String,
    previousTravelHistory: String,

    // Student / Conference
    visaSubType: String,
    intakeDate: String,
    admissionLetter: String,
    sponsorDetails: String,
  },
  { timestamps: true }
);

export default mongoose.model("Visa", visaSchema);