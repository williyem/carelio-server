import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import * as appointmentsService from './appointments.service';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');

router.get(
  '/appointments/:id',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await appointmentsService.getAppointmentById(param(req.params.id));
    res.json(result);
  })
);

export default router;
