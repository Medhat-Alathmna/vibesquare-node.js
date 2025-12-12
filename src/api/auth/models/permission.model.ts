import mongoose, { Schema, Document } from 'mongoose';
import { IPermission, PERMISSION_MODULES, PERMISSION_ACTIONS } from '../auth.types';

export interface IPermissionDocument extends Omit<IPermission, 'id'>, Document {
  id: string;
}

const PermissionSchema = new Schema<IPermissionDocument>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true }, // e.g., 'users.read'
  description: { type: String, required: true },
  module: { type: String, enum: PERMISSION_MODULES, required: true, index: true },
  action: { type: String, enum: PERMISSION_ACTIONS, required: true }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
PermissionSchema.index({ name: 1 });
PermissionSchema.index({ module: 1, action: 1 });

export const Permission = mongoose.model<IPermissionDocument>('Permission', PermissionSchema);
