import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { patientLoginSchema, refreshSchema } from './schemas';
import {
  loginPatient,
  logoutPatient,
  patientSession,
  refreshPatient,
} from './patient-auth.service';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = patientLoginSchema.parse(req.body);
    const result = await loginPatient(body.patientId);
    res.json(result);
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    const result = await refreshPatient(body.refreshToken);
    res.json(result);
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken =
      typeof req.body?.refreshToken === 'string'
        ? req.body.refreshToken
        : undefined;
    const result = await logoutPatient(refreshToken, req.auth?.id);
    res.json(result);
  })
);

router.get(
  '/session',
  requireAuth('patient'),
  asyncHandler(async (req, res) => {
    const result = await patientSession(req.auth!.id);
    res.json(result);
  })
);

export default router;
