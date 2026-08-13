import { Patient, Doctor } from '../../models';
import { AppError } from '../../utils/errors';
import { hashToken } from '../../utils/passwords';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
} from './token-service';

function toPatientUser(patient: {
  _id: { toString(): string };
  email: string | null;
  fullName: string | null;
  dob: Date | null;
  gender: string | null;
  phoneNumber: string | null;
  address: string | null;
  bloodType: string | null;
  patientId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: patient._id.toString(),
    patientId: patient.patientId,
    email: patient.email ?? '',
    fullName: patient.fullName ?? '',
    dob: patient.dob ? patient.dob.toISOString() : '',
    gender: patient.gender ?? 'other',
    phoneNumber: patient.phoneNumber ?? '',
    address: patient.address ?? '',
    bloodType: patient.bloodType ?? 'O+',
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

async function findPatientByInviteToken(token: string) {
  const tokenHash = hashToken(token);
  const patient = await Patient.findOne({ invitationTokenHash: tokenHash });
  if (!patient || !patient.isActive) {
    throw new AppError('Invalid or expired invitation', 400);
  }
  if (
    patient.invitationExpiresAt &&
    patient.invitationExpiresAt < new Date()
  ) {
    throw new AppError('Invitation has expired', 400);
  }
  return patient;
}

export async function verifyInvitation(token: string) {
  const patient = await findPatientByInviteToken(token);

  let doctorName = 'Carelio Care Team';
  if (patient.invitedByDoctorId) {
    const doctor = await Doctor.findById(patient.invitedByDoctorId);
    if (doctor) {
      doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
    }
  }

  return {
    email: patient.email,
    phoneNumber: patient.phoneNumber,
    invitationMethod: 'email' as const,
    doctorName,
    fullName: patient.fullName ?? '',
    dob: patient.dob ? patient.dob.toISOString().slice(0, 10) : '',
    gender: (patient.gender ?? 'other') as 'male' | 'female' | 'other',
    address: patient.address ?? '',
    bloodType: (patient.bloodType ?? 'O+') as
      | 'A+'
      | 'A-'
      | 'B+'
      | 'B-'
      | 'AB+'
      | 'AB-'
      | 'O+'
      | 'O-',
  };
}

export async function completeRegistration(input: {
  token: string;
  fullName: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  phoneNumber: string;
  address: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  email?: string;
}) {
  const patient = await findPatientByInviteToken(input.token);

  if (patient.isRegistrationComplete) {
    throw new AppError('Registration already completed', 400);
  }

  const dob = new Date(input.dob);
  if (Number.isNaN(dob.getTime())) {
    throw new AppError('Invalid date of birth', 400);
  }

  if (input.email) {
    const email = input.email.toLowerCase();
    const existing = await Patient.findOne({
      email,
      _id: { $ne: patient._id },
    });
    if (existing) {
      throw new AppError('Patient with this email already exists', 409);
    }
    patient.email = email;
  }

  patient.fullName = input.fullName;
  patient.dob = dob;
  patient.gender = input.gender;
  patient.phoneNumber = input.phoneNumber;
  patient.address = input.address;
  patient.bloodType = input.bloodType;
  patient.isRegistrationComplete = true;
  // Keep invitation token until agreements/consent are submitted
  await patient.save();

  const tokens = await issueTokenPair(patient._id.toString(), 'patient');
  return {
    accessToken: tokens.tokenData.access.token,
    refreshToken: tokens.tokenData.refresh.token,
    user: toPatientUser(patient),
  };
}

export async function saveAgreements(input: {
  token: string;
  agreements: {
    type: string;
    signatureUrl: string;
    documentUrl: string;
  }[];
}) {
  const patient = await findPatientByInviteToken(input.token);
  const now = new Date();
  const incoming = input.agreements.map((a) => ({
    type: a.type,
    signatureUrl: a.signatureUrl,
    documentUrl: a.documentUrl,
    signedAt: now,
  }));

  patient.agreements = [...(patient.agreements ?? []), ...incoming];
  patient.consentCompletedAt = now;
  patient.invitationTokenHash = undefined;
  patient.invitationExpiresAt = undefined;
  await patient.save();

  return {
    message: 'Agreements saved successfully',
    patientId: patient.patientId,
  };
}

export async function loginPatient(patientId: string) {
  const patient = await Patient.findOne({ patientId: patientId.trim() });
  if (!patient || !patient.isActive) {
    throw new AppError('Invalid patient ID', 401);
  }

  const tokens = await issueTokenPair(patient._id.toString(), 'patient');
  return { ...tokens, user: toPatientUser(patient) };
}

export async function refreshPatient(refreshToken: string) {
  return rotateRefreshToken(refreshToken, 'patient');
}

export async function logoutPatient(refreshToken?: string, userId?: string) {
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  } else if (userId) {
    await revokeAllUserTokens(userId, 'patient');
  }
  return { message: 'Logged out successfully' };
}

export async function patientSession(userId: string) {
  const patient = await Patient.findById(userId);
  if (!patient || !patient.isActive) {
    throw new AppError('Unauthorized', 401);
  }
  return { user: toPatientUser(patient) };
}
