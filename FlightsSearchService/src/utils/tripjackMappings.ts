// utils/tripjackMappings.ts

// Define interfaces for the mapping types
interface IBaseMapping {
    fullForm: string;
}

interface IMappingWithDescription extends IBaseMapping {
    description: string;
}

interface IMappingWithValues extends IBaseMapping {
    values: Record<string, string>;
}

interface IMappingWithBoth extends IMappingWithDescription, IMappingWithValues { }

// Type guard functions
const hasDescription = (mapping: any): mapping is IMappingWithDescription => {
    return 'description' in mapping;
};

const hasValues = (mapping: any): mapping is IMappingWithValues => {
    return 'values' in mapping;
};

export const TripjackMappings: Record<string, IMappingWithDescription | IMappingWithValues | IMappingWithBoth> = {
    ti: {
        fullForm: 'Title',
        description: 'Title of the traveller',
        values: {
            'Mr': 'Mister (Adult Male)',
            'Mrs': 'Missus (Adult Married Female)',
            'Ms': 'Miss (Adult Female)',
            'Master': 'Master (Child Male)'
        }
    },

    fN: {
        fullForm: 'First Name',
        description: 'First name of the traveller'
    },

    lN: {
        fullForm: 'Last Name',
        description: 'Last name of the traveller'
    },

    pt: {
        fullForm: 'Passenger Type',
        description: 'Type of passenger',
        values: {
            'ADULT': 'Adult passenger (age 12-100 years)',
            'CHILD': 'Child passenger (age 2-12 years)',
            'INFANT': 'Infant passenger (age 0-2 years)'
        }
    },

    dob: {
        fullForm: 'Date of Birth',
        description: 'Traveller date of birth (YYYY-MM-DD format)'
    },

    pNat: {
        fullForm: 'Passport Nationality',
        description: 'Passport issuing country (IATA 2-letter country code)'
    },

    pNum: {
        fullForm: 'Passport Number',
        description: 'Passport number of the traveller'
    },

    eD: {
        fullForm: 'Expiry Date',
        description: 'Passport expiry date (YYYY-MM-DD format)'
    },

    pid: {
        fullForm: 'Passport Issue Date',
        description: 'Passport issue date (YYYY-MM-DD format)'
    },

    di: {
        fullForm: 'Document ID',
        description: 'Document ID for student or senior citizen fare'
    },

    ssrBaggageInfos: {
        fullForm: 'Special Service Request - Baggage Information',
        description: 'Selected baggage options for each segment'
    },

    ssrMealInfos: {
        fullForm: 'Special Service Request - Meal Information',
        description: 'Selected meal options for each segment'
    },

    ssrSeatInfos: {
        fullForm: 'Special Service Request - Seat Information',
        description: 'Selected seat options for each segment'
    },

    ssrExtraServiceInfos: {
        fullForm: 'Special Service Request - Extra Services',
        description: 'Selected extra services for each segment'
    },

    key: {
        fullForm: 'Segment Key',
        description: 'Unique identifier for the flight segment from review response'
    },

    code: {
        fullForm: 'SSR Code',
        description: 'Unique code of the selected SSR from supplier'
    },

    paymentInfos: {
        fullForm: 'Payment Information',
        description: 'Payment details for the booking'
    },

    amount: {
        fullForm: 'Total Amount',
        description: 'Total payable amount to Tripjack (TF from review response)'
    },

    gstInfo: {
        fullForm: 'GST Information',
        description: 'Goods and Services Tax information for billing'
    },

    gstNumber: {
        fullForm: 'GST Number',
        description: 'Valid 15-digit GST registration number'
    },

    registeredName: {
        fullForm: 'GST Registered Name',
        description: 'Name as registered with GST (max 35 characters)'
    },

    deliveryInfo: {
        fullForm: 'Delivery Information',
        description: 'Contact details for booking confirmation delivery'
    },

    emails: {
        fullForm: 'Email Addresses',
        description: 'List of email addresses for booking confirmation'
    },

    contacts: {
        fullForm: 'Contact Numbers',
        description: 'List of mobile numbers for booking confirmation'
    },

    contactInfo: {
        fullForm: 'Emergency Contact Information',
        description: 'Emergency contact details required by airline'
    },

    ecn: {
        fullForm: 'Emergency Contact Name',
        description: 'Name of emergency contact person'
    },

    bookingId: {
        fullForm: 'Booking ID',
        description: 'Tripjack booking ID generated after review'
    },

    fC: {
        fullForm: 'Fare Components',
        description: 'Fare components including base fare, taxes, etc.'
    },

    afC: {
        fullForm: 'Additional Fare Components',
        description: 'Detailed breakdown of fare components'
    },

    TAF: {
        fullForm: 'Taxes and Fees',
        description: 'Total taxes and fees'
    },

    NF: {
        fullForm: 'Net Fare',
        description: 'Net fare after deductions'
    },

    BF: {
        fullForm: 'Base Fare',
        description: 'Base fare before taxes'
    },

    TF: {
        fullForm: 'Total Fare',
        description: 'Total fare including all taxes and fees'
    },

    NCM: {
        fullForm: 'Net Commission',
        description: 'Net commission after TDS'
    },

    AGST: {
        fullForm: 'Airline GST',
        description: 'GST component from airline'
    },

    MF: {
        fullForm: 'Management Fee',
        description: 'Tripjack management fee'
    },

    MFT: {
        fullForm: 'Management Fee Tax',
        description: 'Tax on management fee'
    },

    YQ: {
        fullForm: 'Fuel Surcharge',
        description: 'Fuel surcharge'
    },

    OT: {
        fullForm: 'Other Taxes',
        description: 'Other tax components'
    },

    FTC: {
        fullForm: 'Flex Total Charges',
        description: 'TJ_FLEX fare charges (zero cancellation fee option)'
    },

    rT: {
        fullForm: 'Refundable Type',
        description: 'Refundability status',
        values: {
            '0': 'Non Refundable',
            '1': 'Refundable',
            '2': 'Partial Refundable'
        }
    },

    bI: {
        fullForm: 'Baggage Information',
        description: 'Baggage allowance information'
    },

    iB: {
        fullForm: 'Check-in Baggage',
        description: 'Checked baggage allowance'
    },

    cB: {
        fullForm: 'Cabin Baggage',
        description: 'Cabin/hand baggage allowance'
    },

    cc: {
        fullForm: 'Cabin Class',
        description: 'Cabin class of travel',
        values: {
            'ECONOMY': 'Economy Class',
            'PREMIUM_ECONOMY': 'Premium Economy',
            'BUSINESS': 'Business Class',
            'FIRST': 'First Class'
        }
    },

    fB: {
        fullForm: 'Fare Basis',
        description: 'Fare basis code'
    },

    mI: {
        fullForm: 'Meal Indicator',
        description: 'Indicates if meal is included',
        values: {
            'true': 'Free meal included',
            'false': 'Paid meal (can be selected)'
        }
    },

    sI: {
        fullForm: 'Segment Information',
        description: 'Flight segment details'
    },

    fD: {
        fullForm: 'Flight Designator',
        description: 'Flight designator with airline and flight number'
    },

    aI: {
        fullForm: 'Airline Information',
        description: 'Airline code and name'
    },

    da: {
        fullForm: 'Departure Airport',
        description: 'Departure airport details'
    },

    aa: {
        fullForm: 'Arrival Airport',
        description: 'Arrival airport details'
    },

    dt: {
        fullForm: 'Departure Time',
        description: 'Departure date and time'
    },

    at: {
        fullForm: 'Arrival Time',
        description: 'Arrival date and time'
    },

    iand: {
        fullForm: 'Is Arrival Next Day',
        description: 'Indicates if flight arrives next day'
    },

    isRs: {
        fullForm: 'Is Return Segment',
        description: 'Indicates if this is a return segment'
    },

    sN: {
        fullForm: 'Segment Number',
        description: 'Segment number in the journey'
    },

    cT: {
        fullForm: 'Connecting Time',
        description: 'Layover time between segments (in minutes)'
    },

    oB: {
        fullForm: 'Operating Airline',
        description: 'Airline operating the flight'
    },

    isa: {
        fullForm: 'Is Seat Applicable',
        description: 'Indicates if seat selection is available'
    },

    isBA: {
        fullForm: 'Is Blocking Allowed',
        description: 'Indicates if HOLD booking option is available'
    },

    st: {
        fullForm: 'Session Time',
        description: 'Review session valid time in seconds'
    },

    sct: {
        fullForm: 'Session Created Time',
        description: 'Session creation timestamp'
    },

    gstappl: {
        fullForm: 'GST Applicable',
        description: 'Indicates if GST can be applied'
    },

    igm: {
        fullForm: 'Is GST Mandatory',
        description: 'Indicates if GST is mandatory'
    },

    iecr: {
        fullForm: 'Is Emergency Contact Required',
        description: 'Indicates if emergency contact is mandatory'
    },

    status: {
        fullForm: 'Booking Status',
        values: {
            'PENDING': 'Booking is pending confirmation',
            'CONFIRMED': 'Booking confirmed successfully',
            'CANCELLED': 'Booking cancelled by customer',
            'FAILED': 'Booking failed due to error',
            'ON_HOLD': 'Booking is on hold',
            'UNCONFIRMED': 'Hold booking not confirmed, PNR released'
        }
    }
};

export const getFieldFullForm = (field: string): string => {
    const mapping = TripjackMappings[field as keyof typeof TripjackMappings];
    return mapping?.fullForm || field;
};

export const getFieldDescription = (field: string): string => {
    const mapping = TripjackMappings[field as keyof typeof TripjackMappings];
    if (mapping && hasDescription(mapping)) {
        return mapping.description;
    }
    return '';
};

export const getValueMeaning = (field: string, value: string | number): string => {
    const mapping = TripjackMappings[field as keyof typeof TripjackMappings];
    if (mapping && hasValues(mapping)) {
        return mapping.values[value.toString()] || value.toString();
    }
    return value.toString();
};