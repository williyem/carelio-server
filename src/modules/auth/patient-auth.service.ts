import { Patient, Doctor, type IPatient } from '../../models';
import { AppError } from '../../utils/errors';
import {
  hashToken,
  hashPassword,
  verifyPassword,
  generateOtp,
} from '../../utils/passwords';
import { logger } from '../../utils/logger';
import {
  sendVerificationOtpEmail,
  sendPasswordResetOtpEmail,
} from '../mail/resend';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
} from './token-service';

function toPatientUser(patient: IPatient) {
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
    allergies: patient.allergies ?? [],
    medications: patient.medications ?? [],
    conditions: patient.conditions ?? [],
    emergencyContact: {
      name: patient.emergencyContact?.name ?? '',
      relationship: patient.emergencyContact?.relationship ?? '',
      phone: patient.emergencyContact?.phone ?? '',
    },
    emailVerified: Boolean(patient.emailVerified),
    isRegistrationComplete: Boolean(patient.isRegistrationComplete),
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

async function findPatientByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    return Patient.findOne({
      email: trimmed.toLowerCase(),
      isActive: true,
    });
  }
  return Patient.findOne({ patientId: trimmed, isActive: true });
}

async function storeEmailOtp(patient: IPatient) {
  const otp = generateOtp(6);
  patient.verifyEmailOtpHash = hashToken(otp);
  patient.verifyOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await patient.save();
  logger.info(
    `[dev] Patient ${patient.patientId} email OTP: ${otp}`
  );
  return otp;
}

function assertValidOtp(patient: IPatient, otp: string) {
  if (
    !patient.verifyOtpExpiresAt ||
    patient.verifyOtpExpiresAt < new Date() ||
    !patient.verifyEmailOtpHash ||
    patient.verifyEmailOtpHash !== hashToken(otp)
  ) {
    throw new AppError('Invalid or expired code', 400);
  }
}

function clearEmailOtp(patient: IPatient) {
  patient.verifyEmailOtpHash = undefined;
  patient.verifyOtpExpiresAt = undefined;
}

async function issuePatientSession(patient: IPatient) {
  const tokens = await issueTokenPair(patient._id.toString(), 'patient');
  return { ...tokens, user: toPatientUser(patient) };
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
  password: string;
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
  patient.passwordHash = await hashPassword(input.password);
  patient.emailVerified = Boolean(patient.email);
  patient.isRegistrationComplete = true;
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

export async function saveAuthenticatedAgreements(
  userId: string,
  agreements: {
    type: string;
    signatureUrl: string;
    documentUrl: string;
  }[]
) {
  const patient = await Patient.findById(userId);
  if (!patient || !patient.isActive) {
    throw new AppError('Patient not found', 404);
  }

  const now = new Date();
  const incoming = agreements.map((a) => ({
    type: a.type,
    signatureUrl: a.signatureUrl,
    documentUrl: a.documentUrl,
    signedAt: now,
  }));

  patient.agreements = [...(patient.agreements ?? []), ...incoming];
  patient.consentCompletedAt = now;
  patient.isRegistrationComplete = true;
  await patient.save();

  return {
    message: 'Agreements saved successfully',
    patientId: patient.patientId,
    user: toPatientUser(patient),
  };
}

export async function loginPatient(identifier: string, password: string) {
  const patient = await findPatientByIdentifier(identifier);
  if (
    !patient ||
    !patient.passwordHash ||
    !(await verifyPassword(password, patient.passwordHash))
  ) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!patient.emailVerified) {
    if (!patient.email) {
      throw new AppError('Add an email to your record before signing in', 400);
    }
    const otp = await storeEmailOtp(patient);
    try {
      await sendVerificationOtpEmail({ to: patient.email, otp });
    } catch (err) {
      logger.error(
        `[mail] Login verification email failed for ${patient.email}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return {
      requiresEmailVerification: true as const,
      patientId: patient.patientId,
    };
  }

  return issuePatientSession(patient);
}

export async function verifyLoginEmail(patientId: string, otp: string) {
  const patient = await Patient.findOne({
    patientId: patientId.trim(),
    isActive: true,
  });
  if (!patient) {
    throw new AppError('Invalid or expired code', 400);
  }
  assertValidOtp(patient, otp);
  patient.emailVerified = true;
  clearEmailOtp(patient);
  await patient.save();
  return issuePatientSession(patient);
}

export async function forgotPatientPassword(identifier: string) {
  const patient = await findPatientByIdentifier(identifier);
  if (patient?.email) {
    const otp = await storeEmailOtp(patient);
    try {
      await sendPasswordResetOtpEmail({ to: patient.email, otp });
    } catch (err) {
      logger.error(
        `[mail] Password reset email failed for ${patient.email}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
  return { message: 'If that account exists, an OTP has been sent' };
}

export async function resetPatientPassword(
  identifier: string,
  otp: string,
  password: string
) {
  const patient = await findPatientByIdentifier(identifier);
  if (!patient) {
    throw new AppError('Invalid or expired code', 400);
  }
  assertValidOtp(patient, otp);
  patient.passwordHash = await hashPassword(password);
  clearEmailOtp(patient);
  await patient.save();
  return { message: 'Password updated' };
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
