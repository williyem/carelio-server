import { Schema, model, Document } from 'mongoose';
import {
  staffProfileSchemaFields,
  type StaffProfileFields,
} from '../utils/staff-profile';

export type TwoFactorMethod = 'totp' | 'email';

export interface IDoctor extends Document, StaffProfileFields {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  twoFactorEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  totpSecret?: string;
  pendingTotpSecret?: string;
  recoveryCodes: string[];
  isActive: boolean;
  resetOtpHash?: string;
  resetOtpExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorMethod: { type: String, enum: ['totp', 'email'] },
    totpSecret: { type: String },
    pendingTotpSecret: { type: String },
    recoveryCodes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    resetOtpHash: { type: String },
    resetOtpExpiresAt: { type: Date },
    ...staffProfileSchemaFields,
  },
  { timestamps: true }
);

export const Doctor = model<IDoctor>('Doctor', doctorSchema);
