import { Doctor, HealthAssistant, Patient } from '../../models';
import type { IDoctor } from '../../models/Doctor';
import type { IHealthAssistant } from '../../models/HealthAssistant';
import type { IPatient } from '../../models/Patient';
import { AppError } from '../../utils/errors';
import { hashPassword } from '../../utils/passwords';
import { revokeAllUserTokens } from '../auth/token-service';

function serializeDoctor(doctor: IDoctor) {
  return {
    id: doctor._id.toString(),
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    email: doctor.email,
    phoneNumber: doctor.phoneNumber,
    isActive: doctor.isActive,
    isAdmin: Boolean(doctor.isAdmin),
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
    staffCode: ha.staffCode ?? '',
    isActive: ha.isActive,
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
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await Doctor.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const doctor = await Doctor.create({
    email,
    passwordHash: await hashPassword(input.password),
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    mustResetPassword: true,
    isAdmin: false,
    isActive: true,
  });

  return { doctor: serializeDoctor(doctor) };
}

export async function createHealthAssistant(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await HealthAssistant.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const ha = await HealthAssistant.create({
    email,
    passwordHash: await hashPassword(input.password),
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    mustResetPassword: true,
    isActive: true,
  });

  return { healthAssistant: serializeHealthAssistant(ha) };
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
