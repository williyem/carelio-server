import { Types } from 'mongoose';
import {
  AccessGrant,
  Appointment,
  Doctor,
  DoctorAccessRequest,
  HealthAssistant,
  Patient,
} from '../../models';
import { AppError } from '../../utils/errors';
import type { UserRole } from '../../utils/tokens';
import type { AuthUser } from '../../middleware/auth';
import { generateInviteToken } from '../../utils/ids';
import { hashToken } from '../../utils/passwords';
import { env } from '../../config/env';
import { sendDoctorAccessRequestEmail } from '../mail/resend';
import { logger } from '../../utils/logger';

const OTP_GRANT_MS = 24 * 60 * 60 * 1000;

function activeGrantFilter(granteeId: string, patientIds?: Types.ObjectId[]) {
  const filter: Record<string, unknown> = {
    granteeId: new Types.ObjectId(granteeId),
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
  if (patientIds) {
    filter.patientId = { $in: patientIds };
  }
  return filter;
}

export async function hasActiveGrant(patientId: string, granteeId: string) {
  const grant = await AccessGrant.findOne({
    patientId: new Types.ObjectId(patientId),
    granteeId: new Types.ObjectId(granteeId),
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  return Boolean(grant);
}

export async function isStaffLinkedToPatient(
  auth: AuthUser,
  patient: { _id: Types.ObjectId; invitedByDoctorId?: Types.ObjectId | null }
) {
  const patientId = patient._id.toString();
  if (auth.role === 'doctor') {
    if (patient.invitedByDoctorId?.toString() === auth.id) return true;
    const hasVisit = await Appointment.exists({
      patientId: patient._id,
      doctorId: new Types.ObjectId(auth.id),
    });
    if (hasVisit) return true;
  }
  return hasActiveGrant(patientId, auth.id);
}

export async function assertStaffLinkedToPatient(
  auth: AuthUser,
  patient: { _id: Types.ObjectId; invitedByDoctorId?: Types.ObjectId | null }
) {
  const linked = await isStaffLinkedToPatient(auth, patient);
  if (!linked) {
    throw new AppError('You do not have access to this patient’s records', 403);
  }
}

export async function linkedPatientIdSet(
  auth: AuthUser,
  patientIds: Types.ObjectId[]
) {
  const linked = new Set<string>();
  if (!patientIds.length) return linked;

  if (auth.role === 'doctor') {
    const patients = await Patient.find({ _id: { $in: patientIds } }).select(
      'invitedByDoctorId'
    );
    for (const patient of patients) {
      if (patient.invitedByDoctorId?.toString() === auth.id) {
        linked.add(patient._id.toString());
      }
    }

    const visits = await Appointment.find({
      doctorId: new Types.ObjectId(auth.id),
      patientId: { $in: patientIds },
    }).select('patientId');
    for (const visit of visits) {
      linked.add(visit.patientId.toString());
    }
  }

  const grants = await AccessGrant.find(
    activeGrantFilter(auth.id, patientIds)
  ).select('patientId');
  for (const grant of grants) {
    linked.add(grant.patientId.toString());
  }

  return linked;
}

export async function listGrants(patientId: string) {
  const grants = await AccessGrant.find({
    patientId: new Types.ObjectId(patientId),
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).sort({ createdAt: -1 });

  const people = await Promise.all(
    grants.map(async (grant) => {
      const role = grant.granteeRole;
      const person =
        role === 'doctor'
          ? await Doctor.findById(grant.granteeId)
          : await HealthAssistant.findById(grant.granteeId);
      return {
        id: grant.granteeId.toString(),
        grantId: grant._id.toString(),
        name: person
          ? `${person.firstName} ${person.lastName}`.trim()
          : 'Unknown',
        email: person?.email || '',
        role,
        granted: true,
        expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
      };
    })
  );

  return {
    people,
    grantedIds: people.map((p) => p.id),
  };
}

export async function grantAccess(
  patientId: string,
  granteeId: string,
  granteeRole: 'doctor' | 'health-assistant',
  options?: { expiresAt?: Date | null }
) {
  if (!Types.ObjectId.isValid(granteeId)) {
    throw new AppError('Invalid grantee', 400);
  }

  const person =
    granteeRole === 'doctor'
      ? await Doctor.findById(granteeId)
      : await HealthAssistant.findById(granteeId);
  if (!person) throw new AppError('Clinician not found', 404);

  const existing = await AccessGrant.findOne({
    patientId: new Types.ObjectId(patientId),
    granteeId: new Types.ObjectId(granteeId),
  });

  let expiresAt: Date | null | undefined = options?.expiresAt;
  if (existing && existing.expiresAt == null && expiresAt) {
    expiresAt = null;
  }

  const grant = await AccessGrant.findOneAndUpdate(
    {
      patientId: new Types.ObjectId(patientId),
      granteeId: new Types.ObjectId(granteeId),
    },
    {
      patientId: new Types.ObjectId(patientId),
      granteeId: new Types.ObjectId(granteeId),
      granteeRole,
      expiresAt: expiresAt === undefined ? existing?.expiresAt ?? null : expiresAt,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return {
    id: grant!.granteeId.toString(),
    grantId: grant!._id.toString(),
    name: `${person.firstName} ${person.lastName}`.trim(),
    email: person.email,
    role: granteeRole,
    granted: true,
    expiresAt: grant!.expiresAt ? grant!.expiresAt.toISOString() : null,
  };
}

export async function grantOtpAccess(
  patientId: string,
  auth: { id: string; role: UserRole }
) {
  const role =
    auth.role === 'doctor' ? 'doctor' : ('health-assistant' as const);
  return grantAccess(patientId, auth.id, role, {
    expiresAt: new Date(Date.now() + OTP_GRANT_MS),
  });
}

export async function revokeAccess(patientId: string, granteeId: string) {
  const result = await AccessGrant.findOneAndDelete({
    patientId: new Types.ObjectId(patientId),
    granteeId: new Types.ObjectId(granteeId),
  });
  if (!result) throw new AppError('Grant not found', 404);
  return { success: true };
}

export async function createDoctorAccessRequest(
  patientId: string,
  doctorId: string,
  assistantId: string
) {
  const patient = await Patient.findById(patientId);
  if (!patient) throw new AppError('Patient not found', 404);
  if (!patient.email) {
    throw new AppError('Patient has no email on file', 400);
  }

  const linked = await isStaffLinkedToPatient(
    { id: assistantId, role: 'healthAssistant' },
    patient
  );
  if (!linked) {
    throw new AppError('You do not have access to this patient', 403);
  }

  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.isActive) {
    throw new AppError('Doctor not found', 404);
  }

  const assistant = await HealthAssistant.findById(assistantId);
  const token = generateInviteToken();
  await DoctorAccessRequest.create({
    patientId: patient._id,
    doctorId: doctor._id,
    requestedByAssistantId: new Types.ObjectId(assistantId),
    tokenHash: hashToken(token),
    status: 'pending',
  });

  const approveLink = `${env.APP_URL.replace(/\/$/, '')}/patient/approve-doctor?token=${token}`;
  const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`.trim();
  const assistantName = assistant
    ? `${assistant.firstName} ${assistant.lastName}`.trim()
    : 'Your health assistant';

  logger.info(
    `[dev] Doctor access request token for ${patient.patientId}: ${token}`
  );

  try {
    await sendDoctorAccessRequestEmail({
      to: patient.email,
      patientName: patient.fullName || patient.patientId,
      doctorName,
      assistantName,
      approveLink,
    });
  } catch (err) {
    logger.error(
      `[mail] Doctor access request email failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return {
    message: 'Approval email sent to the patient',
    doctorId: doctor._id.toString(),
    doctorName,
    approveLink: env.NODE_ENV === 'production' ? undefined : approveLink,
  };
}

export async function getDoctorAccessRequest(token: string) {
  const request = await DoctorAccessRequest.findOne({
    tokenHash: hashToken(token),
  });
  if (!request) throw new AppError('Request not found', 404);
  const [patient, doctor] = await Promise.all([
    Patient.findById(request.patientId),
    Doctor.findById(request.doctorId),
  ]);
  return {
    status: request.status,
    patientName: patient?.fullName || patient?.patientId || 'Patient',
    doctorName: doctor
      ? `Dr. ${doctor.firstName} ${doctor.lastName}`.trim()
      : 'Doctor',
  };
}

export async function resolveDoctorAccessRequest(
  token: string,
  status: 'approved' | 'declined'
) {
  const request = await DoctorAccessRequest.findOne({
    tokenHash: hashToken(token),
  });
  if (!request) throw new AppError('Request not found', 404);
  if (request.status !== 'pending') {
    throw new AppError('This request has already been answered', 400);
  }

  request.status = status;
  await request.save();

  if (status === 'approved') {
    const patient = await Patient.findById(request.patientId);
    if (!patient) throw new AppError('Patient not found', 404);
    await grantAccess(
      patient._id.toString(),
      request.doctorId.toString(),
      'doctor',
      { expiresAt: null }
    );
    if (!patient.invitedByDoctorId) {
      patient.invitedByDoctorId = request.doctorId;
      await patient.save();
    }
  }

  return { status };
}
