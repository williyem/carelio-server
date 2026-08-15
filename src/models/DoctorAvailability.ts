import { Schema, model, Document, Types } from 'mongoose';
import { defaultAvailabilityDays } from '../utils/staff-profile';

export interface ITimeRange {
  start: string;
  end: string;
}

export interface IDoctorAvailability extends Document {
  doctorId: Types.ObjectId;
  timezone: string;
  enabled: boolean;
  days: Record<string, ITimeRange[]>;
  createdAt: Date;
  updatedAt: Date;
}

const doctorAvailabilitySchema = new Schema<IDoctorAvailability>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      unique: true,
      index: true,
    },
    timezone: { type: String, default: 'GMT' },
    enabled: { type: Boolean, default: true },
    days: { type: Schema.Types.Mixed, default: defaultAvailabilityDays },
  },
  { timestamps: true }
);

export const DoctorAvailability = model<IDoctorAvailability>(
  'DoctorAvailability',
  doctorAvailabilitySchema
);
