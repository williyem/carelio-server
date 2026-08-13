import { Types } from 'mongoose';
import { BillingProfile } from '../../models';

const defaultDoctor = () => ({
  address: {
    line1: '1200 Carelio Way',
    line2: 'Suite 400',
    city: 'Boston',
    state: 'MA',
    zip: '02108',
  },
  card: {
    brand: 'Visa',
    last4: '4242',
    expMonth: '12',
    expYear: '2027',
    nameOnCard: 'Carelio Clinic',
  },
  entitledAmount: '$2,450.00',
  payouts: [
    {
      id: 'po-1',
      invoice: 'INV-1042',
      amount: '$820.00',
      date: 'Aug 1, 2026',
      status: 'Paid' as const,
    },
    {
      id: 'po-2',
      invoice: 'INV-1055',
      amount: '$640.00',
      date: 'Aug 8, 2026',
      status: 'Pending' as const,
    },
  ],
  balance: '$0.00',
  invoices: [],
});

const defaultPatient = () => ({
  address: { line1: '', line2: '', city: '', state: '', zip: '' },
  card: {
    brand: 'Visa',
    last4: '',
    expMonth: '',
    expYear: '',
    nameOnCard: '',
  },
  entitledAmount: '$0.00',
  payouts: [],
  balance: '$0.00',
  invoices: [
    {
      id: 'inv-1',
      description: 'Telehealth consultation',
      amount: '$75.00',
      date: 'Jul 28, 2026',
      status: 'Paid' as const,
    },
  ],
});

function serialize(doc: InstanceType<typeof BillingProfile>) {
  return {
    address: doc.address,
    card: doc.card,
    entitledAmount: doc.entitledAmount,
    payouts: doc.payouts,
    balance: doc.balance,
    invoices: doc.invoices,
  };
}

async function getOrCreate(
  ownerId: string,
  ownerRole: 'doctor' | 'patient'
) {
  let record = await BillingProfile.findOne({
    ownerId: new Types.ObjectId(ownerId),
    ownerRole,
  });
  if (!record) {
    const defaults = ownerRole === 'doctor' ? defaultDoctor() : defaultPatient();
    record = await BillingProfile.create({
      ownerId: new Types.ObjectId(ownerId),
      ownerRole,
      ...defaults,
    });
  }
  return record;
}

export async function getBilling(
  ownerId: string,
  ownerRole: 'doctor' | 'patient'
) {
  const record = await getOrCreate(ownerId, ownerRole);
  return serialize(record);
}

export async function updateDoctorBilling(
  ownerId: string,
  input: {
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    card?: {
      brand?: string;
      last4?: string;
      expMonth?: string;
      expYear?: string;
      nameOnCard?: string;
    };
    entitledAmount?: string;
  }
) {
  const record = await getOrCreate(ownerId, 'doctor');
  if (input.address) {
    record.address = { ...record.address, ...input.address };
  }
  if (input.card) {
    record.card = { ...record.card, ...input.card };
  }
  if (typeof input.entitledAmount === 'string') {
    record.entitledAmount = input.entitledAmount;
  }
  await record.save();
  return serialize(record);
}
