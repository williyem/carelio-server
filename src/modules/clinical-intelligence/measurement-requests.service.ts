import crypto from 'crypto';
import { Types } from 'mongoose';
import { Appointment, type IMeasurementRequest } from '../../models';
import { AppError } from '../../utils/errors';
import type { UserRole } from '../../utils/tokens';
import {
  isMeasurementType,
  labelForMeasurement,
  type MeasurementType,
} from './measurement-catalog';

export type MeasurementRequestStatus = IMeasurementRequest['status'];
export type MeasurementRequestSource = IMeasurementRequest['source'];

function serializeRequest(req: IMeasurementRequest) {
  return {
    id: req.id,
    vitalType: req.vitalType,
    label: req.label,
    source: req.source,
    status: req.status,
    patientResponse: req.patientResponse ?? null,
    requestedAt: req.requestedAt?.toISOString() ?? null,
    respondedAt: req.respondedAt?.toISOString() ?? null,
  };
}

async function getAppointmentOrThrow(appointmentId: string) {
  const appointment = Types.ObjectId.isValid(appointmentId)
    ? await Appointment.findById(appointmentId)
    : null;
  if (!appointment) throw new AppError('Appointment not found', 404);
  return appointment;
}

async function assertParticipant(
  appointment: Awaited<ReturnType<typeof getAppointmentOrThrow>>,
  auth: { id: string; role: UserRole }
) {
  if (auth.role === 'patient') {
    if (appointment.patientId.toString() !== auth.id) {
      throw new AppError('Forbidden', 403);
    }
    return;
  }

  if (auth.role === 'doctor') {
    if (appointment.doctorId.toString() !== auth.id) {
      throw new AppError('Forbidden', 403);
    }
    return;
  }

  if (auth.role === 'healthAssistant') {
    // Any authenticated HA on the consultation may help with devices.
    return;
  }

  throw new AppError('Forbidden', 403);
}

export async function getMeasurementState(
  appointmentId: string,
  auth: { id: string; role: UserRole }
) {
  const appointment = await getAppointmentOrThrow(appointmentId);
  await assertParticipant(appointment, auth);

  return {
    deviceCaptureEnabled: appointment.deviceCaptureEnabled ?? true,
    requests: (appointment.measurementRequests ?? []).map(serializeRequest),
  };
}

export async function setDeviceCaptureEnabled(
  appointmentId: string,
  enabled: boolean,
  auth: { id: string; role: UserRole }
) {
  if (auth.role === 'patient') {
    throw new AppError('Only clinicians can change device capture settings', 403);
  }

  const appointment = await getAppointmentOrThrow(appointmentId);
  await assertParticipant(appointment, auth);

  appointment.deviceCaptureEnabled = enabled;
  await appointment.save();

  return {
    deviceCaptureEnabled: appointment.deviceCaptureEnabled,
    requests: (appointment.measurementRequests ?? []).map(serializeRequest),
  };
}

export async function upsertSuggestedRequests(
  appointmentId: string,
  items: {
    vitalType: string;
    label: string;
    source: MeasurementRequestSource;
  }[],
  auth: { id: string; role: UserRole }
) {
  if (auth.role === 'patient') {
    throw new AppError('Patients cannot create suggestions', 403);
  }

  const appointment = await getAppointmentOrThrow(appointmentId);
  await assertParticipant(appointment, auth);

  const existing = appointment.measurementRequests ?? [];
  const active = existing.filter(
    (r) => !['cancelled', 'completed'].includes(r.status)
  );

  const merged = [...active];
  for (const item of items) {
    if (!isMeasurementType(item.vitalType)) continue;
    const duplicate = merged.find(
      (r) =>
        r.vitalType === item.vitalType &&
        ['suggested', 'requested', 'acknowledged'].includes(r.status)
    );
    if (duplicate) continue;

    merged.push({
      id: `mr_${crypto.randomBytes(6).toString('hex')}`,
      vitalType: item.vitalType,
      label: item.label || labelForMeasurement(item.vitalType),
      source: item.source,
      status: 'suggested',
    });
  }

  appointment.measurementRequests = merged;
  appointment.markModified('measurementRequests');
  await appointment.save();

  return {
    deviceCaptureEnabled: appointment.deviceCaptureEnabled ?? true,
    requests: merged.map(serializeRequest),
  };
}

export async function confirmMeasurementRequests(
  appointmentId: string,
  requestIds: string[],
  auth: { id: string; role: UserRole }
) {
  if (auth.role === 'patient') {
    throw new AppError('Patients cannot confirm measurement requests', 403);
  }

  const appointment = await getAppointmentOrThrow(appointmentId);
  await assertParticipant(appointment, auth);

  const now = new Date();
  const requests = appointment.measurementRequests ?? [];

  for (const id of requestIds) {
    const req = requests.find((r) => r.id === id);
    if (!req || req.status !== 'suggested') continue;
    req.status = 'requested';
    req.requestedAt = now;
  }

  appointment.measurementRequests = requests;
  appointment.markModified('measurementRequests');
  await appointment.save();

  return {
    deviceCaptureEnabled: appointment.deviceCaptureEnabled ?? true,
    requests: requests.map(serializeRequest),
  };
}

export async function createManualRequests(
  appointmentId: string,
  vitalTypes: MeasurementType[],
  auth: { id: string; role: UserRole }
) {
  if (auth.role !== 'doctor') {
    throw new AppError('Only the doctor can request measurements', 403);
  }

  const appointment = await getAppointmentOrThrow(appointmentId);
  await assertParticipant(appointment, auth);

  const now = new Date();
  const existing = appointment.measurementRequests ?? [];
  const merged = [...existing];

  for (const vitalType of vitalTypes) {
    const duplicate = merged.find(
      (r) =>
        r.vitalType === vitalType &&
        ['requested', 'acknowledged'].includes(r.status)
    );
    if (duplicate) continue;

    merged.push({
      id: `mr_${crypto.randomBytes(6).toString('hex')}`,
      vitalType,
      label: labelForMeasurement(vitalType),
      source: 'manual',
      status: 'requested',
      requestedAt: now,
    });
  }

  appointment.measurementRequests = merged;
  appointment.markModified('measurementRequests');
  await appointment.save();

  return {
    deviceCaptureEnabled: appointment.deviceCaptureEnabled ?? true,
    requests: merged.map(serializeRequest),
  };
}

export async function respondToMeasurementRequest(
  appointmentId: string,
  requestId: string,
  status: 'acknowledged' | 'no_device' | 'completed',
  patientResponse: string | undefined,
  auth: { id: string; role: UserRole }
) {
  const appointment = await getAppointmentOrThrow(appointmentId);
  await assertParticipant(appointment, auth);

  const requests = appointment.measurementRequests ?? [];
  const req = requests.find((r) => r.id === requestId);
  if (!req) throw new AppError('Measurement request not found', 404);

  if (auth.role === 'patient') {
    if (req.status !== 'requested') {
      throw new AppError('Request is not awaiting patient response', 400);
    }
    req.status = status;
    req.patientResponse = patientResponse ?? null;
    req.respondedAt = new Date();
  } else {
    if (status === 'completed') {
      req.status = 'completed';
      req.respondedAt = new Date();
    } else if (status === 'acknowledged' || status === 'no_device') {
      req.status = status;
      req.respondedAt = new Date();
    }
  }

  appointment.measurementRequests = requests;
  appointment.markModified('measurementRequests');
  await appointment.save();

  return {
    deviceCaptureEnabled: appointment.deviceCaptureEnabled ?? true,
    requests: requests.map(serializeRequest),
  };
}
