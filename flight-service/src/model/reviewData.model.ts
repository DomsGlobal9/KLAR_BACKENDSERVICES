import mongoose, { Schema, Document } from 'mongoose';

/**
 * ==================== Sub-Interfaces ====================
 */

interface IAirlineInfo {
    AirlineCode?: string;
    AirlineName?: string;
    IsLowCostCarrier?: boolean;
}

interface IAirport {
    AirlineCode?: string;
    AirlineName?: string;
    cityCode?: string;
    city?: string;
    country?: string;
    countryCode?: string;
    terminal?: string;
}

interface ISSREntry {
    AirlineCode?: string;
    amount?: number;
    Description?: string;
    iswca?: boolean;
    isEmdResynced?: boolean;
}

interface ISSRInfo {
    MEAL?: ISSREntry[];
    BAGGAGE?: ISSREntry[];
}

interface IFareComponents {
    TotalFare?: number;
    BaseFare?: number;
    TotalAdditionalFare?: number;
    NetFare?: number;
}

interface IAdditionalFareComponents {
    TotalAdditionalFare?: {
        ManagementFeeTax?: number;
        ManagementFee?: number;
        OtherTaxes?: number;
        AirlineGSTComponent?: number;
        FuelSurcharge?: number;
    };
}

interface IBaggageInfo {
    CheckInBaggage?: string;
    ClassCode?: string;
}

interface IAdultFare {
    FareComponents?: IFareComponents;
    AdditionalFareComponents?: IAdditionalFareComponents;
    SeatsRemaining?: number;
    BaggageInfo?: IBaggageInfo;
    RefundableType?: number;
    CabinClass?: string;
    ClassCode?: string;
    FareBasis?: string;
    MealIncluded?: boolean;
}

interface IFareDetails {
    AdultFare?: IAdultFare;
}

interface IFareComponentsSummary {
    TripjackCancellationFee?: number;
    AirlineCancellationFeeTax?: number;
    TripjackCancellationFeeTax?: number;
    AirlineCancellationFee?: number;
    TripjackRescheduleFee?: number;
    AirlineRescheduleFeeTax?: number;
    AirlineRescheduleFee?: number;
    TripjackRescheduleFeeTax?: number;
}

interface IFareRuleEntry {
    amount?: number;
    additionalFee?: number;
    policyInfo?: string;
    FareComponentsSummary?: IFareComponentsSummary;
    st?: string;
    et?: string;
}

interface ITFR {
    NO_SHOW?: IFareRuleEntry[];
    DATECHANGE?: IFareRuleEntry[];
    CANCELLATION?: IFareRuleEntry[];
    SEAT_CHARGEABLE?: IFareRuleEntry[];
}

interface IFareRuleInformation {
    fr?: Record<string, any>;
    tfr?: ITFR;
}

interface IPc {
    AirlineCode?: string;
    AirlineName?: string;
    IsLowCostCarrier?: boolean;
}

interface ITripAdditionalInfo {
    cci?: Record<string, {
        AdultFare?: string;
    }>;
}

interface ISegmentInformation {
    SegmentID?: string;
    FlightDetails?: {
        AirlineInfo?: IAirlineInfo;
        FlightNumber?: string;
        EquipmentType?: string;
    };
    NumberOfStops?: number;
    StopOverInfo?: any[];
    Duration?: number;
    DepartureAirport?: IAirport;
    ArrivalAirport?: IAirport;
    DepartureTime?: string;
    ArrivalTime?: string;
    IsInternationalAndDomestic?: boolean;
    IsRefundableSegment?: boolean;
    SegmentNumber?: number;
    ssrInfo?: ISSRInfo;
    ac?: any[];
}

interface ITotalPriceList {
    FareDetails?: IFareDetails;
    FareIdentifierType?: string;
    SegmentID?: string;
    messages?: any[];
    pc?: IPc;
    TripAdditionalInfo?: ITripAdditionalInfo;
    fareRuleInformation?: IFareRuleInformation;
}

interface ITripInformation {
    SegmentInformation?: ISegmentInformation[];
    TotalPriceList?: ITotalPriceList[];
    AirFlowType?: string;
    InstantPurchaseMessage?: string;
    IsSpecialFare?: boolean;
    icafdgca?: boolean;
    isWarCrisisFlow?: boolean;
    isFullRefundViaCancellation?: boolean;
}

interface IRouteInfo {
    fromCityOrAirport?: IAirport;
    toCityOrAirport?: IAirport;
    travelDate?: string;
}

interface IPaxInfo {
    AdultFare?: number;
    ChildFare?: number;
    INFANT?: number;
}

interface ISearchModifiers {
    pft?: string;
    pfts?: string[];
}

interface ISearchQuery {
    routeInfos?: IRouteInfo[];
    cabinClass?: string;
    paxInfo?: IPaxInfo;
    requestId?: string;
    searchType?: string;
    searchModifiers?: ISearchModifiers;
    isDomestic?: boolean;
}

interface ITotalFareDetail {
    FareComponents?: IFareComponents;
    AdditionalFareComponents?: IAdditionalFareComponents;
}

interface ITotalPriceInfo {
    totalFareDetail?: ITotalFareDetail;
}

interface IDob {
    adobr?: boolean;
    cdobr?: boolean;
    idobr?: boolean;
}

interface IDc {
    ida?: boolean;
    idm?: boolean;
    iqpe?: boolean;
}

interface IAnlm {
    FlightNumber?: number;
    finml?: number;
    lN?: number;
    lnml?: number;
}

interface IAddOns {
    isbpa?: boolean;
}

interface IGst {
    gstappl?: boolean;
    igm?: boolean;
    igcm?: boolean;
    igpcm?: boolean;
    igsn?: boolean;
}

interface IConditions {
    ffas?: any[];
    isa?: boolean;
    dob?: IDob;
    iecr?: boolean;
    dc?: IDc;
    anlm?: IAnlm;
    ipa?: boolean;
    addOns?: IAddOns;
    iss?: boolean;
    isra?: boolean;
    isbv?: boolean;
    ipua?: boolean;
    isfla?: boolean;
    ifsm?: boolean;
    ifmm?: boolean;
    ifbm?: boolean;
    isBA?: boolean;
    st?: number;
    sct?: string;
    gst?: IGst;
}

interface IStatus {
    success?: boolean;
    httpStatus?: number;
}

interface IAwci {
    eligible?: boolean;
}

interface IMappedData {
    TripInformation?: ITripInformation[];
    searchQuery?: ISearchQuery;
    bookingId?: string;
    totalPriceInfo?: ITotalPriceInfo;
    imoqpe?: boolean;
    awci?: IAwci;
    status?: IStatus;
    conditions?: IConditions;
}

/**
 * ==================== Main Interface ====================
 */

export interface IFlightReview extends Document {
    mappedData?: IMappedData;
    sessionId?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * ==================== Schema Definition ====================
 */

const AirportSchema = new Schema({
    AirlineCode: { type: String, required: false },
    AirlineName: { type: String, required: false },
    cityCode: { type: String, required: false },
    city: { type: String, required: false },
    country: { type: String, required: false },
    countryCode: { type: String, required: false },
    terminal: { type: String, required: false }
}, { _id: false });

const AirlineInfoSchema = new Schema({
    AirlineCode: { type: String, required: false },
    AirlineName: { type: String, required: false },
    IsLowCostCarrier: { type: Boolean, required: false }
}, { _id: false });

const SSREntrySchema = new Schema({
    AirlineCode: { type: String, required: false },
    amount: { type: Number, required: false },
    Description: { type: String, required: false },
    iswca: { type: Boolean, required: false },
    isEmdResynced: { type: Boolean, required: false }
}, { _id: false });

const SSRInfoSchema = new Schema({
    MEAL: { type: [SSREntrySchema], required: false },
    BAGGAGE: { type: [SSREntrySchema], required: false }
}, { _id: false });

const FareComponentsSchema = new Schema({
    TotalFare: { type: Number, required: false },
    BaseFare: { type: Number, required: false },
    TotalAdditionalFare: { type: Number, required: false },
    NetFare: { type: Number, required: false }
}, { _id: false });

const AdditionalFareComponentsSchema = new Schema({
    TotalAdditionalFare: {
        ManagementFeeTax: { type: Number, required: false },
        ManagementFee: { type: Number, required: false },
        OtherTaxes: { type: Number, required: false },
        AirlineGSTComponent: { type: Number, required: false },
        FuelSurcharge: { type: Number, required: false }
    }
}, { _id: false });

const BaggageInfoSchema = new Schema({
    CheckInBaggage: { type: String, required: false },
    ClassCode: { type: String, required: false }
}, { _id: false });

const AdultFareSchema = new Schema({
    FareComponents: { type: FareComponentsSchema, required: false },
    AdditionalFareComponents: { type: AdditionalFareComponentsSchema, required: false },
    SeatsRemaining: { type: Number, required: false },
    BaggageInfo: { type: BaggageInfoSchema, required: false },
    RefundableType: { type: Number, required: false },
    CabinClass: { type: String, required: false },
    ClassCode: { type: String, required: false },
    FareBasis: { type: String, required: false },
    MealIncluded: { type: Boolean, required: false }
}, { _id: false });

const FareDetailsSchema = new Schema({
    AdultFare: { type: AdultFareSchema, required: false }
}, { _id: false });

const FareComponentsSummarySchema = new Schema({
    TripjackCancellationFee: { type: Number, required: false },
    AirlineCancellationFeeTax: { type: Number, required: false },
    TripjackCancellationFeeTax: { type: Number, required: false },
    AirlineCancellationFee: { type: Number, required: false },
    TripjackRescheduleFee: { type: Number, required: false },
    AirlineRescheduleFeeTax: { type: Number, required: false },
    AirlineRescheduleFee: { type: Number, required: false },
    TripjackRescheduleFeeTax: { type: Number, required: false }
}, { _id: false });

const FareRuleEntrySchema = new Schema({
    amount: { type: Number, required: false },
    additionalFee: { type: Number, required: false },
    policyInfo: { type: String, required: false },
    FareComponentsSummary: { type: FareComponentsSummarySchema, required: false },
    st: { type: String, required: false },
    et: { type: String, required: false }
}, { _id: false });

const TFRSchema = new Schema({
    NO_SHOW: { type: [FareRuleEntrySchema], required: false },
    DATECHANGE: { type: [FareRuleEntrySchema], required: false },
    CANCELLATION: { type: [FareRuleEntrySchema], required: false },
    SEAT_CHARGEABLE: { type: [FareRuleEntrySchema], required: false }
}, { _id: false });

const FareRuleInformationSchema = new Schema({
    fr: { type: Schema.Types.Mixed, required: false },
    tfr: { type: TFRSchema, required: false }
}, { _id: false });

const PcSchema = new Schema({
    AirlineCode: { type: String, required: false },
    AirlineName: { type: String, required: false },
    IsLowCostCarrier: { type: Boolean, required: false }
}, { _id: false });

const TripAdditionalInfoSchema = new Schema({
    cci: { type: Schema.Types.Mixed, required: false }
}, { _id: false });

const SegmentInformationSchema = new Schema({
    SegmentID: { type: String, required: false },
    FlightDetails: {
        AirlineInfo: { type: AirlineInfoSchema, required: false },
        FlightNumber: { type: String, required: false },
        EquipmentType: { type: String, required: false }
    },
    NumberOfStops: { type: Number, required: false },
    StopOverInfo: { type: [], required: false },
    Duration: { type: Number, required: false },
    DepartureAirport: { type: AirportSchema, required: false },
    ArrivalAirport: { type: AirportSchema, required: false },
    DepartureTime: { type: String, required: false },
    ArrivalTime: { type: String, required: false },
    IsInternationalAndDomestic: { type: Boolean, required: false },
    IsRefundableSegment: { type: Boolean, required: false },
    SegmentNumber: { type: Number, required: false },
    ssrInfo: { type: SSRInfoSchema, required: false },
    ac: { type: [], required: false }
}, { _id: false });

const TotalPriceListSchema = new Schema({
    FareDetails: { type: FareDetailsSchema, required: false },
    FareIdentifierType: { type: String, required: false },
    SegmentID: { type: String, required: false },
    messages: { type: [], required: false },
    pc: { type: PcSchema, required: false },
    TripAdditionalInfo: { type: TripAdditionalInfoSchema, required: false },
    fareRuleInformation: { type: FareRuleInformationSchema, required: false }
}, { _id: false });

const TripInformationSchema = new Schema({
    SegmentInformation: { type: [SegmentInformationSchema], required: false },
    TotalPriceList: { type: [TotalPriceListSchema], required: false },
    AirFlowType: { type: String, required: false },
    InstantPurchaseMessage: { type: String, required: false },
    IsSpecialFare: { type: Boolean, required: false },
    icafdgca: { type: Boolean, required: false },
    isWarCrisisFlow: { type: Boolean, required: false },
    isFullRefundViaCancellation: { type: Boolean, required: false }
}, { _id: false });

const RouteInfoSchema = new Schema({
    fromCityOrAirport: { type: AirportSchema, required: false },
    toCityOrAirport: { type: AirportSchema, required: false },
    travelDate: { type: String, required: false }
}, { _id: false });

const PaxInfoSchema = new Schema({
    AdultFare: { type: Number, required: false },
    ChildFare: { type: Number, required: false },
    INFANT: { type: Number, required: false }
}, { _id: false });

const SearchModifiersSchema = new Schema({
    pft: { type: String, required: false },
    pfts: { type: [String], required: false }
}, { _id: false });

const SearchQuerySchema = new Schema({
    routeInfos: { type: [RouteInfoSchema], required: false },
    cabinClass: { type: String, required: false },
    paxInfo: { type: PaxInfoSchema, required: false },
    requestId: { type: String, required: false },
    searchType: { type: String, required: false },
    searchModifiers: { type: SearchModifiersSchema, required: false },
    isDomestic: { type: Boolean, required: false }
}, { _id: false });

const DobSchema = new Schema({
    adobr: { type: Boolean, required: false },
    cdobr: { type: Boolean, required: false },
    idobr: { type: Boolean, required: false }
}, { _id: false });

const DcSchema = new Schema({
    ida: { type: Boolean, required: false },
    idm: { type: Boolean, required: false },
    iqpe: { type: Boolean, required: false }
}, { _id: false });

const AnlmSchema = new Schema({
    FlightNumber: { type: Number, required: false },
    finml: { type: Number, required: false },
    lN: { type: Number, required: false },
    lnml: { type: Number, required: false }
}, { _id: false });

const AddOnsSchema = new Schema({
    isbpa: { type: Boolean, required: false }
}, { _id: false });

const GstSchema = new Schema({
    gstappl: { type: Boolean, required: false },
    igm: { type: Boolean, required: false },
    igcm: { type: Boolean, required: false },
    igpcm: { type: Boolean, required: false },
    igsn: { type: Boolean, required: false }
}, { _id: false });

const ConditionsSchema = new Schema({
    ffas: { type: [], required: false },
    isa: { type: Boolean, required: false },
    dob: { type: DobSchema, required: false },
    iecr: { type: Boolean, required: false },
    dc: { type: DcSchema, required: false },
    anlm: { type: AnlmSchema, required: false },
    ipa: { type: Boolean, required: false },
    addOns: { type: AddOnsSchema, required: false },
    iss: { type: Boolean, required: false },
    isra: { type: Boolean, required: false },
    isbv: { type: Boolean, required: false },
    ipua: { type: Boolean, required: false },
    isfla: { type: Boolean, required: false },
    ifsm: { type: Boolean, required: false },
    ifmm: { type: Boolean, required: false },
    ifbm: { type: Boolean, required: false },
    isBA: { type: Boolean, required: false },
    st: { type: Number, required: false },
    sct: { type: String, required: false },
    gst: { type: GstSchema, required: false }
}, { _id: false });

const AwciSchema = new Schema({
    eligible: { type: Boolean, required: false }
}, { _id: false });

const StatusSchema = new Schema({
    success: { type: Boolean, required: false },
    httpStatus: { type: Number, required: false }
}, { _id: false });

const MappedDataSchema = new Schema({
    TripInformation: { type: [TripInformationSchema], required: false },
    searchQuery: { type: SearchQuerySchema, required: false },
    bookingId: { type: String, required: false },
    totalPriceInfo: {
        totalFareDetail: {
            FareComponents: { type: FareComponentsSchema, required: false },
            AdditionalFareComponents: { type: AdditionalFareComponentsSchema, required: false }
        }
    },
    imoqpe: { type: Boolean, required: false },
    awci: { type: AwciSchema, required: false },
    status: { type: StatusSchema, required: false },
    conditions: { type: ConditionsSchema, required: false }
}, { _id: false });

/**
 * ==================== Main Schema ====================
 */

const FlightReviewDataSchema = new Schema({
    mappedData: { type: MappedDataSchema, required: false },
    sessionId: { type: String, required: false }
}, {
    timestamps: true,
    collection: 'flight_fair_review'
});

/**
 * ==================== Model ====================
 */

export const FlightReviewData = mongoose.model<IFlightReview>('FlightReviewDataModel', FlightReviewDataSchema);