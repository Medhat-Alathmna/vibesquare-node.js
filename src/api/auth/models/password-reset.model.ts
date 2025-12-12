import mongoose, { Schema, Document } from 'mongoose';
import { IPasswordResetToken } from '../auth.types';

export interface IPasswordResetDocument extends Omit<IPasswordResetToken, 'id'>, Document {
  id: string;
}

const PasswordResetSchema = new Schema<IPasswordResetDocument>({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true }, // Hashed token
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date }
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
PasswordResetSchema.index({ userId: 1 });
PasswordResetSchema.index({ token: 1 });
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 }); // Auto-delete after 1 hour

export const PasswordReset = mongoose.model<IPasswordResetDocument>('PasswordReset', PasswordResetSchema);
