import mongoose, { Schema, Document } from 'mongoose';
import { IRefreshToken } from '../auth.types';

export interface IRefreshTokenDocument extends Omit<IRefreshToken, 'id'>, Document {
  id: string;
}

const RefreshTokenSchema = new Schema<IRefreshTokenDocument>({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true }, // Hashed token
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date },
  replacedByToken: { type: String }, // For token rotation
  userAgent: { type: String },
  ipAddress: { type: String }
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
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ token: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const RefreshToken = mongoose.model<IRefreshTokenDocument>('RefreshToken', RefreshTokenSchema);
