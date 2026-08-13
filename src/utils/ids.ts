import crypto from 'crypto';

export function generatePatientId(): string {
  const n = crypto.randomInt(1000, 9999);
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PAT-${n}${suffix}`;
}

export function generateAppointmentCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export function generateStaffCode(prefix = 'HA'): string {
  const n = crypto.randomInt(1000, 9999);
  return `${prefix}-${n}`;
}

export function generateInviteToken(): string {
  return crypto.randomBytes(24).toString('hex');
}
