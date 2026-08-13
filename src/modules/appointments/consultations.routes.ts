import crypto from 'crypto';
import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import { Appointment, Patient } from '../../models';
import { AppError } from '../../utils/errors';
import * as appointmentsService from './appointments.service';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');

function ensureTelehealthTokens(apt: {
  code: string;
  telehealth?: {
    doctorToken?: string | null;
    patientToken?: string | null;
    sessionId?: string | null;
  };
  markModified: (path: string) => void;
  save: () => Promise<unknown>;
}) {
  if (!apt.telehealth) {
    apt.telehealth = {};
  }
  if (!apt.telehealth.sessionId) {
    apt.telehealth.sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;
  }
  if (!apt.telehealth.doctorToken) {
    apt.telehealth.doctorToken = `doc_${crypto.randomBytes(16).toString('hex')}`;
  }
  if (!apt.telehealth.patientToken) {
    apt.telehealth.patientToken = `pat_${crypto.randomBytes(16).toString('hex')}`;
  }
  apt.markModified('telehealth');
  return apt.save().then(() => ({
    token: apt.telehealth!.patientToken as string,
    code: apt.code,
  }));
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
  '/:id/token/patient',
  staffAuth,
  asyncHandler(async (req, res) => {
    const id = param(req.params.id);

    let appointment = Types.ObjectId.isValid(id)
      ? await Appointment.findById(id)
      : null;

    if (!appointment) {
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
    }

    const result = await ensureTelehealthTokens(appointment);
    res.json(result);
  })
);

export default router;
