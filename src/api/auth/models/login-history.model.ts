import mongoose, { Schema, Document } from 'mongoose';
import { ILoginHistory, AUTH_PROVIDERS } from '../auth.types';

export interface ILoginHistoryDocument extends Omit<ILoginHistory, 'id'>, Document {
  id: string;
}

const LoginHistorySchema = new Schema<ILoginHistoryDocument>({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  provider: { type: String, enum: AUTH_PROVIDERS, required: true },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  success: { type: Boolean, required: true },
  failureReason: { type: String }
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
LoginHistorySchema.index({ userId: 1, createdAt: -1 });
LoginHistorySchema.index({ ipAddress: 1 });
LoginHistorySchema.index({ createdAt: -1 });

export const LoginHistory = mongoose.model<ILoginHistoryDocument>('LoginHistory', LoginHistorySchema);
