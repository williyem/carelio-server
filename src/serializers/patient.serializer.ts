import type { IPatient } from '../models/Patient';

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString() : '';
}

function dateOnly(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export function serializePatient(
  patient: IPatient,
  extras?: { linked?: boolean }
) {
  const dob = dateOnly(patient.dob);
  const phone = patient.phoneNumber ?? '';

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
    medications: patient.medications ?? [],
    conditions: patient.conditions ?? [],
    emergencyContact: {
      name: patient.emergencyContact?.name ?? '',
      relationship: patient.emergencyContact?.relationship ?? '',
      phone: patient.emergencyContact?.phone ?? '',
    },
    chiefComplaint: patient.chiefComplaint ?? undefined,
    invitedByDoctorId: patient.invitedByDoctorId
      ? patient.invitedByDoctorId.toString()
      : null,
    phoneVerified: patient.phoneVerified,
    emailVerified: patient.emailVerified,
    isActive: patient.isActive,
    isRegistrationComplete: patient.isRegistrationComplete,
    createdAt: iso(patient.createdAt),
    updatedAt: iso(patient.updatedAt),
    avatarUrl: patient.avatarUrl || '',
    insurance: (patient.insurance ?? []).map((policy) => ({
      id: policy._id?.toString() || '',
      provider: policy.provider,
      memberId: policy.memberId,
      groupId: policy.groupId || '',
      holderName: policy.holderName || '',
      effectiveDate: policy.effectiveDate || '',
      expirationDate: policy.expirationDate || '',
      isDefault: Boolean(policy.isDefault),
      cardImageUrl: policy.cardImageUrl || '',
    })),
    linked: extras?.linked,
  };
}
