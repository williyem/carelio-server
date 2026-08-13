import { Router } from 'express';
import doctorRoutes from './doctor.routes';
import healthAssistantRoutes from './health-assistant.routes';
import patientRoutes from './patient.routes';
import {
  doctorInviteRouter,
  assistantInviteRouter,
} from '../patients/invite.routes';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { doctorInviteSchema } from '../patients/schemas';
import * as patientsService from '../patients/patients.service';

const authRouter = Router();

authRouter.use('/doctor', doctorRoutes);
authRouter.use('/doctor', doctorInviteRouter);
authRouter.use('/assistant', healthAssistantRoutes);
authRouter.use('/assistant', assistantInviteRouter);
authRouter.use('/patient', patientRoutes);

// Alias used by some BFF paths: POST /auth/patient/invite
authRouter.post(
  '/patient/invite',
  requireAuth('doctor', 'healthAssistant'),
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

export default authRouter;
