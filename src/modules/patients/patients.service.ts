import { Types } from 'mongoose';
import { Patient, Doctor } from '../../models';
import { AppError } from '../../utils/errors';
import {
  buildPaginatedResult,
  parsePagination,
} from '../../utils/paginate';
import {
  generateInviteToken,
  generatePatientId,
} from '../../utils/ids';
import { generateOtp, hashToken } from '../../utils/passwords';
import { serializePatient } from '../../serializers/patient.serializer';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import {
  sendInviteEmail,
  sendVerificationOtpEmail,
} from '../mail/resend';
import type { UserRole } from '../../utils/tokens';
import type { AuthUser } from '../../middleware/auth';
import * as accessService from '../access/access.service';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function searchFilter(search?: string) {
  if (!search?.trim()) return {};
  const q = escapeRegex(search.trim());
  return {
    $or: [
      { fullName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { patientId: { $regex: q, $options: 'i' } },
      { phoneNumber: { $regex: q, $options: 'i' } },
    ],
  };
}

async function findPatientByIdOrCode(id: string) {
  if (Types.ObjectId.isValid(id)) {
    const byId = await Patient.findById(id);
    if (byId) return byId;
  }
  return Patient.findOne({ patientId: id });
}

export async function listPatients(
  query: {
    search?: string;
    page?: number;
    limit?: number;
  },
  auth?: AuthUser
) {
  const { page, limit, skip } = parsePagination(query);
  let includeInactive = false;
  if (auth?.role === 'doctor') {
    const doctor = await Doctor.findById(auth.id).select('isAdmin isActive');
    includeInactive = Boolean(doctor?.isAdmin && doctor.isActive);
  }
  const filter = {
    ...(includeInactive ? {} : { isActive: true }),
    ...searchFilter(query.search),
  };
  const [docs, totalDocs] = await Promise.all([
    Patient.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Patient.countDocuments(filter),
  ]);
  const linked = auth
    ? await accessService.linkedPatientIdSet(
        auth,
        docs.map((d) => d._id as Types.ObjectId)
      )
    : new Set<string>();
  return buildPaginatedResult(
    docs.map((d) =>
      serializePatient(d, { linked: linked.has(d._id.toString()) })
    ),
    totalDocs,
    page,
    limit
  );
}

/** Directory view for HA/doctor assigned routes — same as listPatients (no sticky HA). */
export async function listAssignedPatients(query: {
  search?: string;
  page?: number;
  limit?: number;
  assistantId?: string;
  callerId?: string;
  callerRole?: UserRole;
}) {
  return listPatients(
    {
      search: query.search,
      page: query.page,
      limit: query.limit,
    },
    query.callerId && query.callerRole
      ? { id: query.callerId, role: query.callerRole }
      : undefined
  );
}

export async function requirePatientAccess(id: string, auth: AuthUser) {
  const patient = await findPatientByIdOrCode(id);
  if (!patient) throw new AppError('Patient not found', 404);
  if (auth.role === 'doctor' || auth.role === 'healthAssistant') {
    await accessService.assertStaffLinkedToPatient(auth, patient);
  }
  return patient;
}

export async function getPatient(id: string, auth?: AuthUser) {
  const patient = auth
    ? await requirePatientAccess(id, auth)
    : await findPatientByIdOrCode(id);
  if (!patient) throw new AppError('Patient not found', 404);
  return serializePatient(patient, { linked: true });
}

export async function registerPatient(
  input: {
    fullName: string;
    dob: string;
    gender: 'male' | 'female' | 'other';
    email: string;
    phoneNumber: string;
    address: string;
    bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    allergies?: string[];
    chiefComplaint?: string;
  },
  auth: { id: string; role: UserRole }
) {
  const existing = await Patient.findOne({
    $or: [{ email: input.email.toLowerCase() }, { phoneNumber: input.phoneNumber }],
  });
  if (existing) {
    throw new AppError('Patient with this email or phone already exists', 409);
  }

  let patientId = generatePatientId();
  while (await Patient.exists({ patientId })) {
    patientId = generatePatientId();
  }

  const patient = await Patient.create({
    patientId,
    fullName: input.fullName,
    dob: new Date(input.dob),
    gender: input.gender,
    email: input.email.toLowerCase(),
    phoneNumber: input.phoneNumber,
    address: input.address,
    bloodType: input.bloodType,
    allergies: input.allergies ?? [],
    chiefComplaint: input.chiefComplaint ?? null,
    invitedByDoctorId:
      auth.role === 'doctor' ? new Types.ObjectId(auth.id) : null,
    isRegistrationComplete: true,
    isActive: true,
    phoneVerified: false,
    emailVerified: false,
  });

  return serializePatient(patient);
}

export async function updatePatient(
  id: string,
  input: Record<string, unknown>
) {
  const patient = await findPatientByIdOrCode(id);
  if (!patient) throw new AppError('Patient not found', 404);

  if (typeof input.fullName === 'string') patient.fullName = input.fullName;
  if (typeof input.dob === 'string') patient.dob = new Date(input.dob);
  if (input.gender === 'male' || input.gender === 'female' || input.gender === 'other') {
    patient.gender = input.gender;
  }
  if (typeof input.email === 'string') patient.email = input.email.toLowerCase();
  if (typeof input.phoneNumber === 'string') patient.phoneNumber = input.phoneNumber;
  if (typeof input.address === 'string') patient.address = input.address;
  if (typeof input.bloodType === 'string') {
    patient.bloodType = input.bloodType as typeof patient.bloodType;
  }
  if (Array.isArray(input.allergies)) patient.allergies = input.allergies as string[];
  if (Array.isArray(input.medications)) {
    patient.medications = input.medications as string[];
  }
  if (Array.isArray(input.conditions)) {
    patient.conditions = input.conditions as string[];
  }
  if (input.emergencyContact && typeof input.emergencyContact === 'object') {
    const contact = input.emergencyContact as {
      name?: string;
      relationship?: string;
      phone?: string;
    };
    patient.emergencyContact = {
      name: contact.name ?? patient.emergencyContact?.name ?? '',
      relationship:
        contact.relationship ?? patient.emergencyContact?.relationship ?? '',
      phone: contact.phone ?? patient.emergencyContact?.phone ?? '',
    };
  }
  if (input.chiefComplaint !== undefined) {
    patient.chiefComplaint =
      input.chiefComplaint === null ? null : String(input.chiefComplaint);
  }
  if (typeof input.isActive === 'boolean') patient.isActive = input.isActive;
    if (typeof input.isRegistrationComplete === 'boolean') {
    patient.isRegistrationComplete = input.isRegistrationComplete;
  }
  if (typeof input.avatarUrl === 'string') {
    patient.avatarUrl = input.avatarUrl;
  }

  await patient.save();
  return serializePatient(patient);
}

export async function softDeletePatient(id: string) {
  const patient = await findPatientByIdOrCode(id);
  if (!patient) throw new AppError('Patient not found', 404);
  patient.isActive = false;
  await patient.save();
  return { message: 'Patient deactivated' };
}

export async function invitePatient(
  input: { email: string; phoneNumber?: string },
  auth: { id: string; role: UserRole }
) {
  const email = input.email.toLowerCase();
  const phoneNumber = input.phoneNumber;

  const existing = await Patient.findOne({ email });
  if (existing) throw new AppError('Patient with this email already exists', 409);

  let patientId = generatePatientId();
  while (await Patient.exists({ patientId })) {
    patientId = generatePatientId();
  }

  const invitationToken = generateInviteToken();
  const patient = await Patient.create({
    patientId,
    email,
    phoneNumber: phoneNumber ?? null,
    fullName: null,
    invitedByDoctorId:
      auth.role === 'doctor' ? new Types.ObjectId(auth.id) : null,
    isRegistrationComplete: false,
    isActive: true,
    phoneVerified: false,
    emailVerified: false,
    invitationTokenHash: hashToken(invitationToken),
    invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const inviteLink = `${env.APP_URL.replace(/\/$/, '')}/patient-invite?token=${invitationToken}`;
  logger.info(`[dev] Patient invite token for ${patientId}: ${invitationToken}`);

  try {
    await sendInviteEmail({ to: email, inviteLink });
  } catch (err) {
    logger.error(
      `[mail] Invite email failed for ${email}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return {
    message: 'Patient invited successfully',
    patientId: patient.patientId,
    inviteLink,
    invitationMethod: 'email' as const,
    invitationToken:
      env.NODE_ENV === 'production' ? undefined : invitationToken,
    patient: serializePatient(patient),
  };
}

export async function startVerify(id: string, type: 'email') {
  const patient = await findPatientByIdOrCode(id);
  if (!patient) throw new AppError('Patient not found', 404);
  if (!patient.email) {
    throw new AppError('Patient has no email on file', 400);
  }

  const otp = generateOtp(6);
  const hash = hashToken(otp);
  patient.verifyOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  patient.verifyEmailOtpHash = hash;
  await patient.save();

  logger.info(
    `[dev] Patient ${patient.patientId} email verification OTP: ${otp}`
  );

  try {
    await sendVerificationOtpEmail({ to: patient.email, otp });
  } catch (err) {
    logger.error(
      `[mail] Verification OTP email failed for ${patient.email}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return {
    id: patient._id.toString(),
    patientId: patient.patientId,
    phoneVerified: patient.phoneVerified,
    emailVerified: patient.emailVerified,
    message: 'Verification code sent via email',
  };
}

export async function confirmVerify(
  id: string,
  code: string,
  type: 'email',
  auth?: AuthUser
) {
  const patient = await findPatientByIdOrCode(id);
  if (!patient) throw new AppError('Patient not found', 404);

  if (
    !patient.verifyOtpExpiresAt ||
    patient.verifyOtpExpiresAt < new Date()
  ) {
    throw new AppError('Verification code expired', 400);
  }

  if (
    !patient.verifyEmailOtpHash ||
    patient.verifyEmailOtpHash !== hashToken(code)
  ) {
    throw new AppError('Invalid verification code', 400);
  }

  patient.emailVerified = true;
  patient.verifyEmailOtpHash = undefined;
  patient.verifyOtpExpiresAt = undefined;
  if (auth?.role === 'doctor' && !patient.invitedByDoctorId) {
    patient.invitedByDoctorId = new Types.ObjectId(auth.id);
  }
  await patient.save();

  if (auth) {
    await accessService.grantOtpAccess(patient._id.toString(), auth);
  }

  return {
    id: patient._id.toString(),
    patientId: patient.patientId,
    phoneVerified: patient.phoneVerified,
    emailVerified: patient.emailVerified,
    linked: true,
  };
}
