import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import { createVitalSchema, confirmVitalsSchema } from './schemas';
import * as vitalsService from './vitals.service';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');
const callAuth = requireAuth('doctor', 'healthAssistant', 'patient');

router.post(
  '/',
  callAuth,
  asyncHandler(async (req, res) => {
    const body = createVitalSchema.parse(req.body);
    const result = await vitalsService.createVital(body, req.auth!);
    res.status(201).json(result);
  })
);

router.get(
  '/appointment/:appointmentId',
  callAuth,
  asyncHandler(async (req, res) => {
    const result = await vitalsService.listByAppointment(
      param(req.params.appointmentId)
    );
    res.json(result);
  })
);

router.post(
  '/appointment/:appointmentId/confirm',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = confirmVitalsSchema.parse(req.body);
    await vitalsService.confirmVitals(
      param(req.params.appointmentId),
      body.vitalIds
    );
    res.json({ message: 'Vitals confirmed' });
  })
);

router.post(
  '/appointment/:appointmentId/reject',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const body = confirmVitalsSchema.parse(req.body);
    await vitalsService.rejectVitals(
      param(req.params.appointmentId),
      body.vitalIds
    );
    res.json({ message: 'Vitals rejected' });
  })
);

export default router;
