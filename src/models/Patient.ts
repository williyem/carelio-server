import { Schema, model, Document, Types } from 'mongoose';

export type Gender = 'male' | 'female' | 'other';
export type BloodType =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export interface IPatient extends Document {
  patientId: string;
  email: string | null;
  phoneNumber: string | null;
  fullName: string | null;
  dob: Date | null;
  gender: Gender | null;
  address: string | null;
  bloodType: BloodType | null;
  invitedByDoctorId: Types.ObjectId | null;
  assignedAssistantId: Types.ObjectId | null;
  isRegistrationComplete: boolean;
  isActive: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  invitationTokenHash?: string;
  invitationExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    patientId: { type: String, required: true, unique: true, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    phoneNumber: { type: String, default: null, trim: true },
    fullName: { type: String, default: null, trim: true },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: undefined },
    address: { type: String, default: null },
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      default: undefined,
    },
    invitedByDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    assignedAssistantId: {
      type: Schema.Types.ObjectId,
      ref: 'HealthAssistant',
      default: null,
    },
    isRegistrationComplete: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    invitationTokenHash: { type: String },
    invitationExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export const Patient = model<IPatient>('Patient', patientSchema);
