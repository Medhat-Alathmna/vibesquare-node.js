import mongoose, { Schema, Document } from 'mongoose';
import { IUser, SUBSCRIPTION_TIERS } from '../auth.types';

export interface IUserDocument extends Omit<IUser, 'id'>, Document {
  id: string;
}

const UserSchema = new Schema<IUserDocument>({
  id: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String }, // Nullable for OAuth-only users
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  avatarUrl: { type: String },

  // OAuth Links
  googleId: { type: String, sparse: true, index: true },
  githubId: { type: String, sparse: true, index: true },

  // Status Flags
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },

  // Role & Subscription
  roleId: { type: String, required: true, index: true },
  subscriptionTier: { type: String, enum: SUBSCRIPTION_TIERS, default: 'free' },

  // Security
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  lastLoginAt: { type: Date },
  passwordChangedAt: { type: Date }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      delete ret.password;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 }, { sparse: true });
UserSchema.index({ githubId: 1 }, { sparse: true });
UserSchema.index({ roleId: 1 });
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUserDocument>('User', UserSchema);
