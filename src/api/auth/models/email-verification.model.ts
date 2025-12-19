import mongoose, { Schema, Document } from 'mongoose';
import { IEmailVerificationToken } from '../auth.types';

export interface IEmailVerificationDocument extends Omit<IEmailVerificationToken, 'id'>, Document {
  id: string;
}

const EmailVerificationSchema = new Schema<IEmailVerificationDocument>({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true }, // Hashed token
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
EmailVerificationSchema.index({ userId: 1 });
EmailVerificationSchema.index({ token: 1 });
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 }); // Auto-delete after 24 hours

export const EmailVerification = mongoose.model<IEmailVerificationDocument>('EmailVerification', EmailVerificationSchema);
