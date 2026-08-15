import { Schema, model, Document, Types } from 'mongoose';

export type DoctorAccessRequestStatus = 'pending' | 'approved' | 'declined';

export interface IDoctorAccessRequest extends Document {
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  requestedByAssistantId: Types.ObjectId;
  tokenHash: string;
  status: DoctorAccessRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const doctorAccessRequestSchema = new Schema<IDoctorAccessRequest>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    requestedByAssistantId: {
      type: Schema.Types.ObjectId,
      ref: 'HealthAssistant',
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

export const DoctorAccessRequest = model<IDoctorAccessRequest>(
  'DoctorAccessRequest',
  doctorAccessRequestSchema
);
