import { Schema, model, Document, Types } from 'mongoose';

export type GranteeRole = 'doctor' | 'health-assistant';

export interface IAccessGrant extends Document {
  patientId: Types.ObjectId;
  granteeId: Types.ObjectId;
  granteeRole: GranteeRole;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const accessGrantSchema = new Schema<IAccessGrant>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    granteeId: { type: Schema.Types.ObjectId, required: true },
    granteeRole: {
      type: String,
      enum: ['doctor', 'health-assistant'],
      required: true,
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

accessGrantSchema.index({ patientId: 1, granteeId: 1 }, { unique: true });

export const AccessGrant = model<IAccessGrant>('AccessGrant', accessGrantSchema);
