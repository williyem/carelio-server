import { Patient } from '../../models';
import { AppError } from '../../utils/errors';
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
