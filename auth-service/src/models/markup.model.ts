import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Which journeys this agent's margin applies to. Mirrors MarkupRegion on the
 * master-owned MarkupConfig deliberately: the two are resolved by the same
 * exact-region-then-ALL rule, and a mismatch between them would price search
 * and commit differently.
 */
export type AgentMarkupRegion = 'DOMESTIC' | 'INTERNATIONAL' | 'ALL';

export const AGENT_MARKUP_REGIONS: AgentMarkupRegion[] = [
  'DOMESTIC',
  'INTERNATIONAL',
  'ALL',
];

export interface IMarkupService {
  _id?: Types.ObjectId;
  serviceType: 'FLIGHT' | 'HOTEL' | 'CABS' | 'TOURSANDPACKAGE' | 'VISA' | string;
  /** Defaults to ALL so every pre-region row keeps its current behaviour. */
  region: AgentMarkupRegion;
  percentageMarkup: number;
  fixedMarkup: number;
}

export interface IMarkup extends Document {
  userId: Types.ObjectId;
  services: IMarkupService[];
  appliedTo?: 'BASE_FARE' | 'TOTAL_FARE' | 'TAXES_ONLY';
  rules?: {
    maxMarkupAmount?: number;
    minBookingAmount?: number;
    maxBookingAmount?: number;
  };
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}



const MarkupServiceSchema = new Schema<IMarkupService>({
  serviceType: { type: String, required: true },
  region: {
    type: String,
    enum: AGENT_MARKUP_REGIONS,
    required: true,
    default: 'ALL',
  },
  percentageMarkup: { type: Number, default: 0, min: 0 },
  fixedMarkup: { type: Number, default: 0, min: 0 },
}, { _id: true });

const MarkupSchema = new Schema<IMarkup>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  services: { type: [MarkupServiceSchema], default: [] },
  appliedTo: { type: String, enum: ['BASE_FARE', 'TOTAL_FARE', 'TAXES_ONLY'], default: 'BASE_FARE' },
  rules: {
    maxMarkupAmount: { type: Number, min: 0 },
    minBookingAmount: { type: Number, min: 0 },
    maxBookingAmount: { type: Number, min: 0 },
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Critical indexes for performance
MarkupSchema.index({ userId: 1 }, { unique: true });
MarkupSchema.index({ userId: 1, isActive: 1 });

/**
 * A service is identified by (serviceType, region), not serviceType alone —
 * "HOTEL DOMESTIC" and "HOTEL INTERNATIONAL" are two legitimate rows, but a
 * second "HOTEL DOMESTIC" is not. Without this guard the resolver would pick
 * whichever duplicate happened to come first in the array, so an agent editing
 * their margin could silently keep being charged the old one.
 */
const assertNoDuplicateServices = (services: any[]) => {
  const seen = new Set<string>();
  services.forEach((service: any) => {
    const region = service.region || 'ALL';
    const key = `${(service.serviceType || '').toUpperCase()}|${region}`;
    if (seen.has(key)) {
      throw new Error(
        `DUPLICATE MARKUP: ${service.serviceType} already has a ${region} rule. Edit that one instead of adding a second.`
      );
    }
    seen.add(key);
  });
};

const assertAddOnlyOne = (services: any[]) => {
  services.forEach((service: any) => {
    if (service.percentageMarkup > 0 && service.fixedMarkup > 0) {
      throw new Error(`ADD ONLY ONE: Each service can only have either percentage or fixed markup. Issue in ${service.serviceType} (${service.region || 'ALL'})`);
    }
  });
};

// Pre-save hook to enforce "Add Only One" rule
MarkupSchema.pre('save', function (this: any, next: any) {
  if (this.services && Array.isArray(this.services)) {
    assertAddOnlyOne(this.services);
    assertNoDuplicateServices(this.services);
  }
  next();
});

// Pre-findOneAndUpdate hook to enforce the rule on updates
MarkupSchema.pre('findOneAndUpdate', function (this: any) {
  const update = this.getUpdate() as mongoose.UpdateQuery<IMarkup>;

  const checkServices = (services: any[]) => {
    assertAddOnlyOne(services);
    assertNoDuplicateServices(services);
  };

  if (update && update.services && Array.isArray(update.services)) {
    checkServices(update.services);
  } else if (update && update.$set && update.$set.services && Array.isArray(update.$set.services)) {
    checkServices(update.$set.services);
  } else if (update && update.$push && update.$push.services) {
    const pushService = update.$push.services as any;
    if (pushService.percentageMarkup > 0 && pushService.fixedMarkup > 0) {
      throw new Error(`ADD ONLY ONE: Each service can only have either percentage or fixed markup.`);
    }
  }
 
});



export const Markup = mongoose.model<IMarkup>('Markup', MarkupSchema);