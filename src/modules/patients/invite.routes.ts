import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { doctorInviteSchema, haInviteSchema } from './schemas';
import * as patientsService from './patients.service';

export const doctorInviteRouter = Router();
export const assistantInviteRouter = Router();

doctorInviteRouter.post(
  '/invite-patient',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const body = doctorInviteSchema.parse(req.body);
    const result = await patientsService.invitePatient(
      {
        email: body.email,
        phoneNumber: body.phoneNumber || body.phone,
      },
      req.auth!
    );
    res.status(201).json(result);
  })
);

assistantInviteRouter.post(
  '/invite-patient',
  requireAuth('healthAssistant'),
  asyncHandler(async (req, res) => {
    const body = haInviteSchema.parse(req.body);
    const result = await patientsService.invitePatient(
      { email: body.email },
      req.auth!
    );
    res.status(201).json(result);
  })
);
