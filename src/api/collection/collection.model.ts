import mongoose, { Schema, Document } from 'mongoose';

export interface ICollection extends Document {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  projectIds: string[];
  tags: string[];
  createdAt: Date;
  featured: boolean;
}

const CollectionSchema = new Schema<ICollection>({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  thumbnail: { type: String, required: true },
  projectIds: [{ type: String }],
  tags: [{ type: String, index: true }],
  featured: { type: Boolean, default: false, index: true }
}, {
  timestamps: true
});

export const Collection = mongoose.model<ICollection>('Collection', CollectionSchema);
