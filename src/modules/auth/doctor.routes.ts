import { Router } from 'express';
import { Doctor } from '../../models';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { createStaffAuthService } from './staff-auth.service';
import {
  loginSchema,
  verify2FASchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  refreshSchema,
  changePasswordSchema,
  setup2FASchema,
  enable2FASchema,
  disable2FASchema,
  regenerateRecoverySchema,
} from './schemas';

const doctorAuth = createStaffAuthService({
  model: Doctor,
  role: 'doctor',
  issuerLabel: 'Doctor',
});

const router = Router();

router.post('/register', (_req, res) => {
  res.status(403).json({
    message: 'Staff accounts are created by a Super admin',
  });
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await doctorAuth.login(body.email, body.password);
    res.json(result);
  })
);

router.post(
  '/verify-2fa',
  asyncHandler(async (req, res) => {
    const body = verify2FASchema.parse(req.body);
    const result = await doctorAuth.verify2FA(body.token, body.code);
    res.json(result);
  })
);

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const result = await doctorAuth.forgotPassword(body.email);
    res.json(result);
  })
);

router.post(
  '/verify-reset-otp',
  asyncHandler(async (req, res) => {
    const body = verifyOtpSchema.parse(req.body);
    const result = await doctorAuth.verifyResetOtp(body.email, body.otp);
    res.json(result);
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const header = req.headers.authorization;
    const tempToken = header?.startsWith('Bearer ')
      ? header.slice(7)
      : (req.body.token as string | undefined);
    const result = await doctorAuth.resetPassword(tempToken, body.password);
    res.json(result);
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    const result = await doctorAuth.refresh(body.refreshToken);
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
    const result = await doctorAuth.logout(refreshToken, req.auth?.id);
    res.json(result);
  })
);

router.get(
  '/session',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const result = await doctorAuth.session(req.auth!.id);
    res.json(result);
  })
);

router.post(
  '/change-password',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    const result = await doctorAuth.changePassword(
      req.auth!.id,
      body.oldPassword,
      body.newPassword
    );
    res.json(result);
  })
);

router.post(
  '/setup-2fa',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const body = setup2FASchema.parse(req.body ?? {});
    const result = await doctorAuth.setup2FA(req.auth!.id, body.method);
    res.json(result);
  })
);

router.post(
  '/enable-2fa',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const body = enable2FASchema.parse(req.body);
    const result = await doctorAuth.enable2FA(req.auth!.id, body.code);
    res.json(result);
  })
);

router.post(
  '/disable-2fa',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const body = disable2FASchema.parse(req.body);
    const result = await doctorAuth.disable2FA(req.auth!.id, body.password);
    res.json(result);
  })
);

router.post(
  '/regenerate-recovery-codes',
  requireAuth('doctor'),
  asyncHandler(async (req, res) => {
    const body = regenerateRecoverySchema.parse(req.body);
    const result = await doctorAuth.regenerateRecoveryCodes(
      req.auth!.id,
      body.password
    );
    res.json(result);
  })
);

export default router;
