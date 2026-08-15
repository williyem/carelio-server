import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import { listAppointmentsQuerySchema } from './schemas';
import * as appointmentsService from './appointments.service';
import { AppError } from '../../utils/errors';
import { Patient } from '../../models';
import { requirePatientAccess } from '../patients/patients.service';

const router = Router({ mergeParams: true });
const staffOrPatientAuth = requireAuth('doctor', 'healthAssistant', 'patient');

async function assertPatientCanAccess(
  auth: { id: string; role: string },
  patientIdParam: string
) {
  if (auth.role !== 'patient') return;

  if (auth.id === patientIdParam) return;

  const self = await Patient.findById(auth.id);
  if (!self) throw new AppError('Unauthorized', 401);

  if (
    self.patientId === patientIdParam ||
    self._id.toString() === patientIdParam
  ) {
    return;
  }

  throw new AppError('Forbidden', 403);
}

router.get(
  '/',
  staffOrPatientAuth,
  asyncHandler(async (req, res) => {
    const patientIdParam = param(req.params.patientId);
    await assertPatientCanAccess(req.auth!, patientIdParam);
    if (req.auth!.role === 'doctor' || req.auth!.role === 'healthAssistant') {
      await requirePatientAccess(patientIdParam, req.auth!);
    }

    const query = listAppointmentsQuerySchema.parse(req.query);
    const result = await appointmentsService.listPatientAppointments(
      patientIdParam,
      query
    );
    res.json(result);
  })
);

export default router;
