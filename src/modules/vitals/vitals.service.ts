import { Types } from 'mongoose';
import { Vital, Appointment, Patient, HealthAssistant, type VitalType } from '../../models';
import { AppError } from '../../utils/errors';
import type { UserRole } from '../../utils/tokens';

async function resolvePatientObjectId(patientId: string): Promise<Types.ObjectId> {
  if (Types.ObjectId.isValid(patientId)) {
    const byId = await Patient.findById(patientId);
    if (byId) return byId._id as Types.ObjectId;
  }
  const byCode = await Patient.findOne({ patientId });
  if (!byCode) throw new AppError('Patient not found', 404);
  return byCode._id as Types.ObjectId;
}

function serializeVital(
  vital: {
    _id: { toString(): string };
    appointmentId: Types.ObjectId;
    patientId: Types.ObjectId;
    recordedByAssistantId?: Types.ObjectId | null;
    vitalType: string;
    reading: Record<string, unknown>;
    deviceId?: string | null;
    recordedAt: Date;
    status: string;
    confirmedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  recordedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null
) {
  return {
    id: vital._id.toString(),
    appointmentId: vital.appointmentId.toString(),
    patientId: vital.patientId.toString(),
    recordedByAssistantId: vital.recordedByAssistantId
      ? vital.recordedByAssistantId.toString()
      : '',
    vitalType: vital.vitalType,
    reading: vital.reading,
    deviceId: vital.deviceId ?? null,
    recordedAt: vital.recordedAt.toISOString(),
    status: vital.status,
    isConfirmed: vital.status === 'confirmed',
    confirmedAt: vital.confirmedAt ? vital.confirmedAt.toISOString() : undefined,
    createdAt: vital.createdAt.toISOString(),
    updatedAt: vital.updatedAt.toISOString(),
    ...(recordedBy ? { recordedBy } : {}),
  };
}

export async function createVital(
  input: {
    appointmentId: string;
    patientId: string;
    vitalType: VitalType;
    reading: Record<string, unknown>;
    recordedAt: string;
    deviceId?: string;
  },
  auth: { id: string; role: UserRole }
) {
  const appointment = await Appointment.findById(input.appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);

  const patientObjectId = await resolvePatientObjectId(input.patientId);
  if (appointment.patientId.toString() !== patientObjectId.toString()) {
    throw new AppError('Patient does not match appointment', 400);
  }

  if (auth.role === 'patient' && appointment.patientId.toString() !== auth.id) {
    throw new AppError('Forbidden', 403);
  }

  const recordedAt = new Date(input.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) {
    throw new AppError('Invalid recordedAt', 400);
  }

  const vital = await Vital.create({
    appointmentId: appointment._id,
    patientId: patientObjectId,
    recordedByAssistantId:
      auth.role === 'healthAssistant' ? new Types.ObjectId(auth.id) : null,
    vitalType: input.vitalType,
    reading: input.reading,
    deviceId: input.deviceId ?? null,
    recordedAt,
    status:
      auth.role === 'doctor' && input.reading?.source !== 'manual'
        ? 'pending'
        : 'confirmed',
    confirmedAt:
      auth.role === 'doctor' && input.reading?.source !== 'manual'
        ? null
        : new Date(),
  });

  return serializeVital(vital);
}

export async function listByAppointment(appointmentId: string) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);

  const docs = await Vital.find({ appointmentId: appointment._id }).sort({
    recordedAt: -1,
  });

  const assistantIds = [
    ...new Set(
      docs
        .map((d) => d.recordedByAssistantId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const assistants = assistantIds.length
    ? await HealthAssistant.find({ _id: { $in: assistantIds } })
    : [];
  const assistantMap = new Map(
    assistants.map((a) => [
      a._id.toString(),
      {
        id: a._id.toString(),
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
      },
    ])
  );

  return docs.map((d) =>
    serializeVital(
      d,
      d.recordedByAssistantId
        ? assistantMap.get(d.recordedByAssistantId.toString()) ?? null
        : null
    )
  );
}

export async function rejectVitals(
  appointmentId: string,
  vitalIds: string[]
) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);

  if (!vitalIds.length) {
    throw new AppError('vitalIds is required', 400);
  }

  const objectIds = vitalIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  await Vital.updateMany(
    {
      _id: { $in: objectIds },
      appointmentId: appointment._id,
    },
    {
      $set: {
        status: 'discarded',
        confirmedAt: null,
      },
    }
  );
}

export async function confirmVitals(
  appointmentId: string,
  vitalIds: string[]
) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);

  if (!vitalIds.length) {
    throw new AppError('vitalIds is required', 400);
  }

  const objectIds = vitalIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  await Vital.updateMany(
    {
      _id: { $in: objectIds },
      appointmentId: appointment._id,
      status: { $ne: 'discarded' },
    },
    {
      $set: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    }
  );
}
