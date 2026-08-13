import { Schema, model, Document } from 'mongoose';

export type TwoFactorMethod = 'totp' | 'email';

export interface IHealthAssistant extends Document {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  staffCode: string;
  twoFactorEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  totpSecret?: string;
  pendingTotpSecret?: string;
  recoveryCodes: string[];
  isActive: boolean;
  mustResetPassword: boolean;
  resetOtpHash?: string;
  resetOtpExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const healthAssistantSchema = new Schema<IHealthAssistant>(
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
    staffCode: { type: String, unique: true, sparse: true, trim: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorMethod: { type: String, enum: ['totp', 'email'] },
    totpSecret: { type: String },
    pendingTotpSecret: { type: String },
    recoveryCodes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    mustResetPassword: { type: Boolean, default: false },
    resetOtpHash: { type: String },
    resetOtpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

healthAssistantSchema.pre('save', function () {
  if (!this.staffCode) {
    const n = Math.floor(1000 + Math.random() * 9000);
    this.staffCode = `HA-${n}`;
  }
});

export const HealthAssistant = model<IHealthAssistant>(
  'HealthAssistant',
  healthAssistantSchema
);
