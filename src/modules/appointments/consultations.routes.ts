import crypto from 'crypto';
import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import { Appointment, Patient, Doctor, HealthAssistant } from '../../models';
import { AppError } from '../../utils/errors';
import * as appointmentsService from './appointments.service';
import * as notesService from '../notes/notes.service';
import { z } from 'zod';
import { mintLiveKitToken } from '../livekit/tokens';
import type { UserRole } from '../../utils/tokens';
import { extractMeasurements } from '../clinical-intelligence/clinical-intelligence.service';
import * as measurementRequestsService from '../clinical-intelligence/measurement-requests.service';
import {
  confirmRequestsSchema,
  createRequestsSchema,
  deviceCaptureSchema,
  extractMeasurementsSchema,
  respondRequestSchema,
} from '../clinical-intelligence/schemas';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');
const doctorAuth = requireAuth('doctor');
const callAuth = requireAuth('doctor', 'healthAssistant', 'patient');

function ensureSessionId(apt: {
  telehealth?: {
    doctorToken?: string | null;
    patientToken?: string | null;
    sessionId?: string | null;
  };
  markModified: (path: string) => void;
}) {
  if (!apt.telehealth) {
    apt.telehealth = {};
  }
  if (!apt.telehealth.sessionId) {
    apt.telehealth.sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;
    apt.markModified('telehealth');
  }
  return apt.telehealth.sessionId;
}

async function findAppointmentForToken(id: string) {
  let appointment = Types.ObjectId.isValid(id)
    ? await Appointment.findById(id)
    : null;

  if (appointment) return appointment;

  let patientObjectId: Types.ObjectId | null = null;
  if (Types.ObjectId.isValid(id)) {
    const patient = await Patient.findById(id);
    if (patient) patientObjectId = patient._id as Types.ObjectId;
  }
  if (!patientObjectId) {
    const byCode = await Patient.findOne({ patientId: id });
    if (byCode) patientObjectId = byCode._id as Types.ObjectId;
  }
  if (!patientObjectId) {
    throw new AppError('Consultation or patient not found', 404);
  }

  appointment = await Appointment.findOne({
    patientId: patientObjectId,
    status: { $in: ['CONFIRMED', 'PENDING_CONFIRMATION'] },
  }).sort({ startTime: 1 });

  if (!appointment) {
    throw new AppError('No active consultation found for patient', 404);
  }

  return appointment;
}

async function displayNameForAuth(auth: { id: string; role: UserRole }) {
  if (auth.role === 'doctor') {
    const doctor = await Doctor.findById(auth.id);
    if (doctor) return `Dr. ${doctor.firstName} ${doctor.lastName}`.trim();
  }
  if (auth.role === 'healthAssistant') {
    const assistant = await HealthAssistant.findById(auth.id);
    if (assistant) return `${assistant.firstName} ${assistant.lastName}`.trim();
  }
  const patient = await Patient.findById(auth.id);
  return patient?.fullName || patient?.patientId || auth.role;
}

async function issueCallToken(
  appointmentId: string,
  auth: { id: string; role: UserRole }
) {
  const appointment = await findAppointmentForToken(appointmentId);
  const roomName = ensureSessionId(appointment);
  await appointment.save();

  const minted = await mintLiveKitToken({
    identity: `${auth.role}:${auth.id}`,
    name: await displayNameForAuth(auth),
    roomName,
  });

  return {
    token: minted.token,
    url: minted.url,
    code: appointment.code,
  };
}

router.get(
  '/appointments/:id',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await appointmentsService.getAppointmentById(
      param(req.params.id)
    );
    res.json(result);
  })
);

router.get(
  '/:id/token/doctor',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await issueCallToken(param(req.params.id), req.auth!);
    res.json(result);
  })
);

router.get(
  '/:id/token/patient',
  callAuth,
  asyncHandler(async (req, res) => {
    const result = await issueCallToken(param(req.params.id), req.auth!);
    res.json(result);
  })
);

const soapSchema = z.object({
  subjective: z.string().optional().default(''),
  objective: z.string().optional().default(''),
  assessment: z.string().optional().default(''),
  plan: z.string().optional().default(''),
  action: z.enum(['save', 'approve']).optional(),
});

router.put(
  '/notes/:noteId',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = soapSchema.parse(req.body);
    const result = await notesService.updateNote(param(req.params.noteId), body);
    res.json(result);
  })
);

router.post(
  '/:id/soap',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = soapSchema.parse(req.body);
    const result = await notesService.upsertSoap(param(req.params.id), {
      subjective: body.subjective ?? '',
      objective: body.objective ?? '',
      assessment: body.assessment ?? '',
      plan: body.plan ?? '',
      action: body.action,
    });
    res.status(201).json(result);
  })
);

router.post(
  '/:id/complete',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await notesService.completeConsultation(param(req.params.id));
    res.json(result);
  })
);

router.patch(
  '/:id/device-capture',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = deviceCaptureSchema.parse(req.body);
    const result = await measurementRequestsService.setDeviceCaptureEnabled(
      param(req.params.id),
      body.enabled,
      req.auth!
    );
    res.json(result);
  })
);

router.post(
  '/:id/extract-measurements',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = extractMeasurementsSchema.parse(req.body);
    const extracted = await extractMeasurements(body.text);
    const result = await measurementRequestsService.upsertSuggestedRequests(
      param(req.params.id),
      extracted.measurements.map((item) => ({
        vitalType: item.vitalType,
        label: item.label,
        source: extracted.strategy === 'ai' ? 'ai' : 'rules',
      })),
      req.auth!
    );
    res.json({
      ...result,
      strategy: extracted.strategy,
      degraded: extracted.degraded,
    });
  })
);

router.get(
  '/:id/measurement-requests',
  callAuth,
  asyncHandler(async (req, res) => {
    const result = await measurementRequestsService.getMeasurementState(
      param(req.params.id),
      req.auth!
    );
    res.json(result);
  })
);

router.post(
  '/:id/measurement-requests',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = confirmRequestsSchema.parse(req.body);
    const result = await measurementRequestsService.confirmMeasurementRequests(
      param(req.params.id),
      body.requestIds,
      req.auth!
    );
    res.json(result);
  })
);

router.post(
  '/:id/measurement-requests/manual',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const body = createRequestsSchema.parse(req.body);
    const result = await measurementRequestsService.createManualRequests(
      param(req.params.id),
      body.vitalTypes,
      req.auth!
    );
    res.json(result);
  })
);

router.patch(
  '/:id/measurement-requests/:requestId',
  callAuth,
  asyncHandler(async (req, res) => {
    const body = respondRequestSchema.parse(req.body);
    const result = await measurementRequestsService.respondToMeasurementRequest(
      param(req.params.id),
      param(req.params.requestId),
      body.status,
      body.patientResponse,
      req.auth!
    );
    res.json(result);
  })
);

export default router;
