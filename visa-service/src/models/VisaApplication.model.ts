import mongoose, { Schema, Document } from 'mongoose';

export interface IVisaApplication extends Document {
    // Personal Information
    fullName: string;
    contactNumber: string;
    email: string;
    currentCity: string;
    country: string;
    destinationCountry: string;
    travelDate: Date;
    purpose: string;
    
    // Employment Fields (Optional)
    employmentStatus?: 'Employed' | 'Self Employed';
    applicantName?: string;
    companyName?: string;
    designation?: string;
    businessEmail?: string;
    businessContact?: string;
    invitationLetterAvailable?: 'Yes' | 'No' | 'yes' | 'no';
    previousTravelHistory?: 'Yes' | 'No' | 'yes' | 'no';
    
    // Family/Tourist Fields (Optional)
    primaryApplicantName?: string;
    primaryContactNumber?: string;
    primaryEmail?: string;
    numberOfAdults?: number;
    numberOfChildren?: number;
    everyoneHoldingValidPassport?: 'Yes' | 'No' | 'yes' | 'no';
    previousVisaRefusal?: 'Yes' | 'No' | 'yes' | 'no';
    visaType?: string;
    intakeEventDate?: Date;
    admissionLetterAvailable?: 'Yes' | 'No' | 'yes' | 'no';
    sponsorDetails?: 'self' | 'parent' | 'company' | 'Self' | 'Parent' | 'Company';
    
    // Common
    visaCategory: 'employment' | 'family' | 'tourist' | 'student' | 'business';
    createdAt: Date;
    updatedAt: Date;
}

const VisaApplicationSchema = new Schema({
    // Personal Information (Required)
    fullName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true },
    currentCity: { type: String, required: true },
    country: { type: String, required: true },
    destinationCountry: { type: String, required: true },
    travelDate: { type: Date, required: true },
    purpose: { type: String, required: true },
    
    // Employment Fields
    employmentStatus: { 
        type: String, 
        enum: ['Employed', 'Self Employed'], 
        required: false 
    },
    applicantName: { type: String, required: false },
    companyName: { type: String, required: false },
    designation: { type: String, required: false },
    businessEmail: { type: String, required: false },
    businessContact: { type: String, required: false },
    invitationLetterAvailable: { 
        type: String, 
        enum: ['Yes', 'No', 'yes', 'no'], 
        required: false 
    },
    previousTravelHistory: { 
        type: String, 
        enum: ['Yes', 'No', 'yes', 'no'], 
        required: false 
    },
    
    // Family/Tourist Fields
    primaryApplicantName: { type: String, required: false },
    primaryContactNumber: { type: String, required: false },
    primaryEmail: { type: String, required: false },
    numberOfAdults: { type: Number, required: false },
    numberOfChildren: { type: Number, required: false },
    everyoneHoldingValidPassport: { 
        type: String, 
        enum: ['Yes', 'No', 'yes', 'no'], 
        required: false 
    },
    previousVisaRefusal: { 
        type: String, 
        enum: ['Yes', 'No', 'yes', 'no'], 
        required: false 
    },
    visaType: { type: String, required: false },
    intakeEventDate: { type: Date, required: false },
    admissionLetterAvailable: { 
        type: String, 
        enum: ['Yes', 'No', 'yes', 'no'], 
        required: false 
    },
    sponsorDetails: { 
        type: String, 
        enum: ['self', 'parent', 'company', 'Self', 'Parent', 'Company'], 
        required: false 
    },
    
    // Category
    visaCategory: { 
        type: String, 
        enum: ['employment', 'family', 'tourist', 'student', 'business'],
        required: true 
    }
}, { timestamps: true });

export default mongoose.model<IVisaApplication>('VisaApplication', VisaApplicationSchema);