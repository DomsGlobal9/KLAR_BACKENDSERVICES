import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMarkupService {
  serviceType: 'FLIGHT' | 'HOTEL' | 'TOURSANDPACKAGE' | 'VISA' | string;
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
  percentageMarkup: { type: Number, default: 0, min: 0, max: 100 },
  fixedMarkup: { type: Number, default: 0, min: 0 },
}, { _id: false });

const MarkupSchema = new Schema<IMarkup>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  services: { type: [MarkupServiceSchema], default: [] },
  // appliedTo: { type: String, enum: ['BASE_FARE', 'TOTAL_FARE', 'TAXES_ONLY'], default: 'BASE_FARE' },
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

// Pre-save hook to enforce percentageMarkup and fixedMarkup rule
MarkupSchema.pre('save', function (this: any, next: any) {
  if (this.services && Array.isArray(this.services)) {
    this.services.forEach((service: any) => {
      if (service.percentageMarkup > 0) {
        service.fixedMarkup = 0;
      } else if (service.fixedMarkup > 0) {
        service.percentageMarkup = 0;
      }
    });
  }
  next();
});

// Pre-findOneAndUpdate hook to enforce the rule on updates
MarkupSchema.pre('findOneAndUpdate', function (this: any, next: any) {
  const update = this.getUpdate() as mongoose.UpdateQuery<IMarkup>;
  
  if (update && update.services && Array.isArray(update.services)) {
    update.services.forEach((service: any) => {
      if (service.percentageMarkup > 0) {
        service.fixedMarkup = 0;
      } else if (service.fixedMarkup > 0) {
        service.percentageMarkup = 0;
      }
    });
  } else if (update && update.$set && update.$set.services && Array.isArray(update.$set.services)) {
    update.$set.services.forEach((service: any) => {
      if (service.percentageMarkup > 0) {
        service.fixedMarkup = 0;
      } else if (service.fixedMarkup > 0) {
        service.percentageMarkup = 0;
      }
    });
  } else if (update && update.$push && update.$push.services) {
    const pushService = update.$push.services as any;
    if (pushService.percentageMarkup > 0) {
      pushService.fixedMarkup = 0;
    } else if (pushService.fixedMarkup > 0) {
      pushService.percentageMarkup = 0;
    }
  }
  next();
});

export const Markup = mongoose.model<IMarkup>('Markup', MarkupSchema);