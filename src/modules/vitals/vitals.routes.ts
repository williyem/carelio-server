import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import { createVitalSchema, confirmVitalsSchema } from './schemas';
import * as vitalsService from './vitals.service';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');

router.post(
  '/',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = createVitalSchema.parse(req.body);
    const result = await vitalsService.createVital(body, req.auth!);
    res.status(201).json(result);
  })
);

router.get(
  '/appointment/:appointmentId',
  staffAuth,
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

export default router;
