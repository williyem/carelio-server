import { Schema, model, Document, Types } from 'mongoose';

export type VitalType =
  | 'thermometer'
  | 'blood-pressure'
  | 'pulse-ox'
  | 'glucose'
  | 'weight-scale'
  | 'stethoscope'
  | 'microscope';

export type VitalStatus = 'pending' | 'confirmed' | 'discarded';

export interface IVital extends Document {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  recordedByAssistantId: Types.ObjectId | null;
  vitalType: VitalType;
  reading: Record<string, unknown>;
  deviceId: string | null;
  recordedAt: Date;
  status: VitalStatus;
  confirmedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vitalSchema = new Schema<IVital>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    recordedByAssistantId: {
      type: Schema.Types.ObjectId,
      ref: 'HealthAssistant',
      default: null,
    },
    vitalType: {
      type: String,
      enum: [
        'thermometer',
        'blood-pressure',
        'pulse-ox',
        'glucose',
        'weight-scale',
        'stethoscope',
        'microscope',
      ],
      required: true,
    },
    reading: { type: Schema.Types.Mixed, required: true },
    deviceId: { type: String, default: null },
    recordedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'discarded'],
      default: 'pending',
      index: true,
    },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Vital = model<IVital>('Vital', vitalSchema);
