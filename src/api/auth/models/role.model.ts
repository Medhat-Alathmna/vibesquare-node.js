import mongoose, { Schema, Document } from 'mongoose';
import { IRole } from '../auth.types';

export interface IRoleDocument extends Omit<IRole, 'id'>, Document {
  id: string;
}

const RoleSchema = new Schema<IRoleDocument>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  isSystem: { type: Boolean, default: false },
  canAccessAdmin: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  permissions: [{ type: String }] // Permission IDs
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
RoleSchema.index({ name: 1 });
RoleSchema.index({ isSystem: 1 });
RoleSchema.index({ isActive: 1 });

export const Role = mongoose.model<IRoleDocument>('Role', RoleSchema);
