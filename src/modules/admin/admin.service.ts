import { Doctor, HealthAssistant, Patient } from '../../models';
import type { IDoctor } from '../../models/Doctor';
import type { IHealthAssistant } from '../../models/HealthAssistant';
import type { IPatient } from '../../models/Patient';
import { AppError } from '../../utils/errors';
import { generateInviteToken } from '../../utils/ids';
import { hashToken } from '../../utils/passwords';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { sendStaffInviteEmail } from '../mail/resend';
import { revokeAllUserTokens } from '../auth/token-service';

const INVITE_DAYS = 7;

function serializeDoctor(doctor: IDoctor) {
  return {
    id: doctor._id.toString(),
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    email: doctor.email,
    phoneNumber: doctor.phoneNumber,
    avatarUrl: doctor.avatarUrl || '',
    isActive: doctor.isActive,
    isAdmin: Boolean(doctor.isAdmin),
    emailVerified: Boolean(doctor.emailVerified),
    createdAt: doctor.createdAt.toISOString(),
  };
}

function serializeHealthAssistant(ha: IHealthAssistant) {
  return {
    id: ha._id.toString(),
    firstName: ha.firstName,
    lastName: ha.lastName,
    email: ha.email,
    phoneNumber: ha.phoneNumber,
    avatarUrl: ha.avatarUrl || '',
    staffCode: ha.staffCode ?? '',
    isActive: ha.isActive,
    emailVerified: Boolean(ha.emailVerified),
    createdAt: ha.createdAt.toISOString(),
  };
}

function serializePatient(patient: IPatient) {
  return {
    id: patient._id.toString(),
    patientId: patient.patientId,
    fullName: patient.fullName ?? '',
    email: patient.email ?? '',
    phoneNumber: patient.phoneNumber ?? '',
    isActive: patient.isActive,
    isRegistrationComplete: patient.isRegistrationComplete,
    createdAt: patient.createdAt.toISOString(),
  };
}

function inviteExpiry() {
  return new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
}

export async function listDoctors() {
  const docs = await Doctor.find().sort({ createdAt: -1 });
  return { doctors: docs.map(serializeDoctor) };
}

export async function listHealthAssistants() {
  const docs = await HealthAssistant.find().sort({ createdAt: -1 });
  return { healthAssistants: docs.map(serializeHealthAssistant) };
}

export async function listPatients() {
  const docs = await Patient.find().sort({ createdAt: -1 });
  return { patients: docs.map(serializePatient) };
}

export async function createDoctor(input: {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await Doctor.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const invitationToken = generateInviteToken();
  const doctor = await Doctor.create({
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    mustResetPassword: false,
    emailVerified: false,
    invitationTokenHash: hashToken(invitationToken),
    invitationExpiresAt: inviteExpiry(),
    isAdmin: false,
    isActive: true,
  });

  const inviteLink = `${env.APP_URL.replace(/\/$/, '')}/staff-invite?token=${invitationToken}&role=doctor`;
  logger.info(`[dev] Doctor invite token for ${email}: ${invitationToken}`);
  await sendStaffInviteEmail({
    to: email,
    inviteLink,
    role: 'doctor',
    firstName: input.firstName,
  });

  return {
    doctor: serializeDoctor(doctor),
    inviteLink: env.NODE_ENV === 'production' ? undefined : inviteLink,
  };
}

export async function createHealthAssistant(input: {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await HealthAssistant.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const invitationToken = generateInviteToken();
  const ha = await HealthAssistant.create({
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    mustResetPassword: false,
    emailVerified: false,
    invitationTokenHash: hashToken(invitationToken),
    invitationExpiresAt: inviteExpiry(),
    isActive: true,
  });

  const inviteLink = `${env.APP_URL.replace(/\/$/, '')}/staff-invite?token=${invitationToken}&role=health-assistant`;
  logger.info(`[dev] HA invite token for ${email}: ${invitationToken}`);
  await sendStaffInviteEmail({
    to: email,
    inviteLink,
    role: 'healthAssistant',
    firstName: input.firstName,
  });

  return {
    healthAssistant: serializeHealthAssistant(ha),
    inviteLink: env.NODE_ENV === 'production' ? undefined : inviteLink,
  };
}

export async function setDoctorActive(
  id: string,
  isActive: boolean,
  actorId: string
) {
  if (!isActive && id === actorId) {
    throw new AppError('You cannot revoke your own account', 400);
  }

  const doctor = await Doctor.findById(id);
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  doctor.isActive = isActive;
  await doctor.save();

  if (!isActive) {
    await revokeAllUserTokens(id, 'doctor');
  }

  return { doctor: serializeDoctor(doctor) };
}

export async function setHealthAssistantActive(id: string, isActive: boolean) {
  const ha = await HealthAssistant.findById(id);
  if (!ha) {
    throw new AppError('Health assistant not found', 404);
  }

  ha.isActive = isActive;
  await ha.save();

  if (!isActive) {
    await revokeAllUserTokens(id, 'healthAssistant');
  }

  return { healthAssistant: serializeHealthAssistant(ha) };
}

export async function setPatientActive(id: string, isActive: boolean) {
  const patient = await Patient.findById(id);
  if (!patient) {
    throw new AppError('Patient not found', 404);
  }

  patient.isActive = isActive;
  await patient.save();

  if (!isActive) {
    await revokeAllUserTokens(id, 'patient');
  }

  return { patient: serializePatient(patient) };
}
