import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import { listAppointmentsQuerySchema } from './schemas';
import * as appointmentsService from './appointments.service';

const router = Router({ mergeParams: true });
const staffAuth = requireAuth('doctor', 'healthAssistant');

router.get(
  '/',
  staffAuth,
  asyncHandler(async (req, res) => {
    const query = listAppointmentsQuerySchema.parse(req.query);
    const result = await appointmentsService.listPatientAppointments(
      param(req.params.patientId),
      query
    );
    res.json(result);
  })
);

export default router;
