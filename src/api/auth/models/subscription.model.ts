import mongoose, { Schema, Document } from 'mongoose';
import { ISubscription, SUBSCRIPTION_TIERS, SUBSCRIPTION_STATUS } from '../auth.types';

export interface ISubscriptionDocument extends Omit<ISubscription, 'id'>, Document {
  id: string;
}

const SubscriptionSchema = new Schema<ISubscriptionDocument>({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, unique: true, index: true },
  tier: { type: String, enum: SUBSCRIPTION_TIERS, required: true, default: 'free' },
  status: { type: String, enum: SUBSCRIPTION_STATUS, required: true, default: 'active' },

  // Stripe Integration (future)
  stripeCustomerId: { type: String, sparse: true },
  stripeSubscriptionId: { type: String, sparse: true },
  stripePriceId: { type: String },

  // Billing Period
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelledAt: { type: Date }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ stripeCustomerId: 1 }, { sparse: true });
SubscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });
SubscriptionSchema.index({ status: 1 });

export const Subscription = mongoose.model<ISubscriptionDocument>('Subscription', SubscriptionSchema);
