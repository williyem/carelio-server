import { Schema, model, Document, Types } from 'mongoose';
import type { UserRole } from '../utils/tokens';

export interface IRefreshToken extends Document {
  tokenHash: string;
  userId: Types.ObjectId;
  role: UserRole;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    role: {
      type: String,
      required: true,
      enum: ['doctor', 'patient', 'healthAssistant'],
    },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema
);
