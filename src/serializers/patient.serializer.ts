import type { IPatient } from '../models/Patient';
import type { IHealthAssistant } from '../models/HealthAssistant';

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString() : '';
}

function dateOnly(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function isPopulatedAssistant(
  value: unknown
): value is IHealthAssistant {
  return (
    !!value &&
    typeof value === 'object' &&
    'email' in value &&
    'firstName' in value
  );
}

export function serializeAssistant(ha: IHealthAssistant | null | undefined) {
  if (!ha) return undefined;
  return {
    id: ha._id.toString(),
    staffCode: ha.staffCode ?? '',
    firstName: ha.firstName,
    lastName: ha.lastName,
    email: ha.email,
    phoneNumber: ha.phoneNumber,
    twoFactorEnabled: ha.twoFactorEnabled,
    twoFactorSecret: ha.totpSecret ?? '',
    isActive: ha.isActive,
    createdAt: iso(ha.createdAt),
    updatedAt: iso(ha.updatedAt),
  };
}

export function serializePatient(patient: IPatient) {
  const dob = dateOnly(patient.dob);
  const phone = patient.phoneNumber ?? '';

  const rawAssigned = patient.assignedAssistantId;
  const assignedAssistant = isPopulatedAssistant(rawAssigned)
    ? serializeAssistant(rawAssigned)
    : undefined;

  const assignedAssistantId = rawAssigned
    ? isPopulatedAssistant(rawAssigned)
      ? rawAssigned._id.toString()
      : rawAssigned.toString()
    : null;

  return {
    id: patient._id.toString(),
    patientId: patient.patientId,
    fullName: patient.fullName ?? '',
    dob,
    dateOfBirth: dob,
    gender: patient.gender ?? 'other',
    email: patient.email ?? '',
    phone,
    phoneNumber: phone,
    address: patient.address ?? '',
    bloodType: patient.bloodType ?? undefined,
    allergies: patient.allergies ?? [],
    chiefComplaint: patient.chiefComplaint ?? undefined,
    invitedByDoctorId: patient.invitedByDoctorId
      ? patient.invitedByDoctorId.toString()
      : null,
    assignedAssistantId,
    phoneVerified: patient.phoneVerified,
    emailVerified: patient.emailVerified,
    isActive: patient.isActive,
    isRegistrationComplete: patient.isRegistrationComplete,
    createdAt: iso(patient.createdAt),
    updatedAt: iso(patient.updatedAt),
    ...(assignedAssistant ? { assignedAssistant } : {}),
  };
}
