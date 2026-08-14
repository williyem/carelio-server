import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import {
  patientLoginSchema,
  patientVerifyLoginEmailSchema,
  patientForgotPasswordSchema,
  patientResetPasswordSchema,
  refreshSchema,
  completeRegistrationSchema,
} from './schemas';
import {
  loginPatient,
  logoutPatient,
  patientSession,
  refreshPatient,
  verifyInvitation,
  completeRegistration,
  verifyLoginEmail,
  forgotPatientPassword,
  resetPatientPassword,
} from './patient-auth.service';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = patientLoginSchema.parse(req.body);
    const result = await loginPatient(body.identifier, body.password);
    res.json(result);
  })
);

router.post(
  '/verify-login-email',
  asyncHandler(async (req, res) => {
    const body = patientVerifyLoginEmailSchema.parse(req.body);
    const result = await verifyLoginEmail(body.patientId, body.otp);
    res.json(result);
  })
);

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const body = patientForgotPasswordSchema.parse(req.body);
    const result = await forgotPatientPassword(body.identifier);
    res.json(result);
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const body = patientResetPasswordSchema.parse(req.body);
    const result = await resetPatientPassword(
      body.identifier,
      body.otp,
      body.password
    );
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

router.get(
  '/verify-invitation',
  asyncHandler(async (req, res) => {
    const token =
      typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }
    const result = await verifyInvitation(token);
    res.json(result);
  })
);

router.get(
  '/verify-consent',
  asyncHandler(async (req, res) => {
    const token =
      typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }
    const result = await verifyInvitation(token);
    res.json(result);
  })
);

router.post(
  '/complete-registration',
  asyncHandler(async (req, res) => {
    const body = completeRegistrationSchema.parse(req.body);
    const result = await completeRegistration(body);
    res.json(result);
  })
);

export default router;
