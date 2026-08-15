import type { SchemaDefinition } from 'mongoose';

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type DayName = (typeof DAYS_OF_WEEK)[number];

export interface StaffProfileFields {
  avatarUrl?: string;
  title?: string;
  specialty?: string;
  clinicName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  timezone?: string;
  npi?: string;
  licenseNumber?: string;
  onboardingCompletedAt?: Date | null;
  signedAgreementUrl?: string;
  signedName?: string;
}

export const staffProfileSchemaFields: SchemaDefinition = {
  avatarUrl: { type: String, default: '' },
  title: { type: String, default: '', trim: true },
  specialty: { type: String, default: '', trim: true },
  clinicName: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  zip: { type: String, default: '', trim: true },
  timezone: { type: String, default: 'America/New_York', trim: true },
  npi: { type: String, default: '', trim: true },
  licenseNumber: { type: String, default: '', trim: true },
  onboardingCompletedAt: { type: Date, default: null },
  signedAgreementUrl: { type: String, default: '' },
  signedName: { type: String, default: '', trim: true },
};

const PATCHABLE: (keyof StaffProfileFields)[] = [
  'avatarUrl',
  'title',
  'specialty',
  'clinicName',
  'address',
  'city',
  'state',
  'zip',
  'timezone',
  'npi',
  'licenseNumber',
];

export function applyStaffProfilePatch<T extends StaffProfileFields>(
  doc: T,
  input: Record<string, unknown>
) {
  if (typeof input.firstName === 'string') {
    (doc as T & { firstName?: string }).firstName = input.firstName;
  }
  if (typeof input.lastName === 'string') {
    (doc as T & { lastName?: string }).lastName = input.lastName;
  }
  if (typeof input.phoneNumber === 'string') {
    (doc as T & { phoneNumber?: string }).phoneNumber = input.phoneNumber;
  } else if (typeof input.phone === 'string') {
    (doc as T & { phoneNumber?: string }).phoneNumber = input.phone;
  }

  for (const key of PATCHABLE) {
    if (typeof input[key] === 'string') {
      (doc as Record<string, unknown>)[key] = input[key];
    }
  }
}

export function serializeStaffProfile(user: StaffProfileFields & {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}) {
  return {
    avatarUrl: user.avatarUrl || '',
    title: user.title || '',
    specialty: user.specialty || '',
    clinicName: user.clinicName || '',
    address: user.address || '',
    city: user.city || '',
    state: user.state || '',
    zip: user.zip || '',
    timezone: user.timezone || 'America/New_York',
    npi: user.npi || '',
    licenseNumber: user.licenseNumber || '',
    phone: user.phoneNumber || '',
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    onboardingCompletedAt: user.onboardingCompletedAt
      ? user.onboardingCompletedAt.toISOString()
      : null,
    signedAgreementUrl: user.signedAgreementUrl || '',
    signedName: user.signedName || '',
  };
}

export function defaultAvailabilityDays(): Record<
  DayName,
  { start: string; end: string }[]
> {
  const weekday = (): { start: string; end: string }[] => [
    { start: '09:00', end: '17:00' },
  ];
  return {
    Sunday: [],
    Monday: weekday(),
    Tuesday: weekday(),
    Wednesday: weekday(),
    Thursday: weekday(),
    Friday: weekday(),
    Saturday: [],
  };
}
