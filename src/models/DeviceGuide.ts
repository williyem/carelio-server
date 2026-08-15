import { Schema, model, Document } from 'mongoose';

/** Built-in seeds; custom admin devices may use any kebab-case slug. */
export const DEVICE_GUIDE_SLUGS = [
  'thermometer',
  'blood-pressure',
  'pulse-ox',
  'glucose',
  'weight-scale',
] as const;

export type DeviceGuideSlug = string;

export interface IDeviceGuide extends Document {
  slug: string;
  title: string;
  shortLabel: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  youtubeUrl?: string;
  tips: string[];
  steps: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const deviceGuideSchema = new Schema<IDeviceGuide>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: { type: String, required: true, trim: true },
    shortLabel: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    youtubeUrl: { type: String, default: '' },
    tips: { type: [String], default: [] },
    steps: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const DeviceGuide = model<IDeviceGuide>('DeviceGuide', deviceGuideSchema);
