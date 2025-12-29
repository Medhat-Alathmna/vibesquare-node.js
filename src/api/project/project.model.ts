import mongoose, { Schema, Document } from 'mongoose';
import { FRAMEWORKS, CATEGORIES, Framework, Category, Prompt, CodeFile, Builder, BuilderSocialLinks } from '../../shared/types';

// CodeFile subdocument schema
const CodeFileSchema = new Schema({
  filename: { type: String, required: true },
  language: { type: String, required: true },
  content: { type: String, required: true },
  path: { type: String }
}, { _id: false });

// Prompt subdocument schema
const PromptSchema = new Schema({
  text: { type: String, required: true },
  model: { type: String, required: true },
  version: { type: String },
  parameters: { type: Schema.Types.Mixed }
}, { _id: false });

// Builder subdocument schema
const BuilderSchema = new Schema({
  userId: { type: String },
  name: { type: String, required: true },
  avatarUrl: { type: String }
}, { _id: false });

// BuilderSocialLinks subdocument schema
const BuilderSocialLinksSchema = new Schema({
  github: { type: String },
  twitter: { type: String },
  linkedin: { type: String },
  portfolio: { type: String }
}, { _id: false });

export interface IProject extends Document {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots: string[];
  demoUrl?: string;
  downloadUrl?: string;
  prompt: Prompt;
  framework: Framework;
  tags: string[];
  styles: string[];
  category: Category;
  likes: number;
  views: number;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
  collectionIds: string[];
  codeFiles: CodeFile[];
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
}

const ProjectSchema = new Schema<IProject>({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, index: 'text' },
  description: { type: String, required: true, index: 'text' },
  shortDescription: { type: String, required: true },
  thumbnail: { type: String, required: true },
  screenshots: [{ type: String }],
  demoUrl: { type: String },
  downloadUrl: { type: String },
  prompt: { type: PromptSchema, required: true },
  framework: { type: String, enum: FRAMEWORKS, required: true, index: true },
  tags: [{ type: String, index: true }],
  styles: [{ type: String }],
  category: { type: String, enum: CATEGORIES, required: true, index: true },
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  collectionIds: [{ type: String }],
  codeFiles: [CodeFileSchema],
  builder: { type: BuilderSchema },
  builderSocialLinks: { type: BuilderSocialLinksSchema }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Text index for search
ProjectSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
