import { Schema, model, Document, Types } from 'mongoose';

export interface IBillingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export interface IBillingCard {
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
  nameOnCard: string;
}

export interface IPayoutRow {
  id: string;
  invoice: string;
  amount: string;
  date: string;
  status: 'Paid' | 'Pending';
}

export interface IPatientInvoice {
  id: string;
  description: string;
  amount: string;
  date: string;
  status: 'Paid' | 'Due';
}

export interface IBillingProfile extends Document {
  ownerId: Types.ObjectId;
  ownerRole: 'doctor' | 'patient';
  address: IBillingAddress;
  card: IBillingCard;
  entitledAmount: string;
  payouts: IPayoutRow[];
  balance: string;
  invoices: IPatientInvoice[];
  createdAt: Date;
  updatedAt: Date;
}

const billingProfileSchema = new Schema<IBillingProfile>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    ownerRole: { type: String, enum: ['doctor', 'patient'], required: true },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
    },
    card: {
      brand: { type: String, default: 'Visa' },
      last4: { type: String, default: '' },
      expMonth: { type: String, default: '' },
      expYear: { type: String, default: '' },
      nameOnCard: { type: String, default: '' },
    },
    entitledAmount: { type: String, default: '$0.00' },
    payouts: { type: Schema.Types.Mixed, default: [] },
    balance: { type: String, default: '$0.00' },
    invoices: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

billingProfileSchema.index({ ownerId: 1, ownerRole: 1 }, { unique: true });

export const BillingProfile = model<IBillingProfile>(
  'BillingProfile',
  billingProfileSchema
);
