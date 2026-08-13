import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { HealthAssistant } from '../../models';
import { AppError } from '../../utils/errors';
import { toStaffUser } from '../auth/staff-auth.service';
import { applyStaffProfilePatch } from '../../utils/staff-profile';

const router = Router();
const haAuth = requireAuth('healthAssistant');

const profilePatchSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phoneNumber: z.string().optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().optional(),
    title: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    timezone: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const onboardingSchema = z.object({
  signedName: z.string().min(1),
  signedAgreementUrl: z.string().optional(),
});

router.get(
  '/profile',
  haAuth,
  asyncHandler(async (req, res) => {
    const ha = await HealthAssistant.findById(req.auth!.id);
    if (!ha || !ha.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    res.json({
      ...toStaffUser(ha),
      staffCode: ha.staffCode,
    });
  })
);

router.patch(
  '/profile',
  haAuth,
  asyncHandler(async (req, res) => {
    const body = profilePatchSchema.parse(req.body);
    const ha = await HealthAssistant.findById(req.auth!.id);
    if (!ha || !ha.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    applyStaffProfilePatch(ha, body);
    await ha.save();
    res.json({
      ...toStaffUser(ha),
      staffCode: ha.staffCode,
    });
  })
);

router.post(
  '/onboarding/complete',
  haAuth,
  asyncHandler(async (req, res) => {
    const body = onboardingSchema.parse(req.body);
    const ha = await HealthAssistant.findById(req.auth!.id);
    if (!ha || !ha.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    applyStaffProfilePatch(ha, req.body);
    ha.signedName = body.signedName;
    if (body.signedAgreementUrl) {
      ha.signedAgreementUrl = body.signedAgreementUrl;
    }
    ha.onboardingCompletedAt = new Date();
    await ha.save();
    res.json({
      ...toStaffUser(ha),
      staffCode: ha.staffCode,
    });
  })
);

export default router;
