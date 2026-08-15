import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import * as staffInviteService from './staff-invite.service';

const router = Router();

const roleSchema = z.enum(['doctor', 'health-assistant']);

const completeInviteSchema = z.object({
  token: z.string().min(1),
  role: roleSchema,
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().min(5).optional(),
  title: z.string().optional(),
  specialty: z.string().optional(),
  clinicName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  timezone: z.string().optional(),
  npi: z.string().optional(),
  licenseNumber: z.string().optional(),
  signedName: z.string().min(1),
  signedAgreementUrl: z.string().optional(),
});

router.get(
  '/verify-invite',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || '');
    const role = roleSchema.parse(String(req.query.role || ''));
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }
    const result = await staffInviteService.verifyStaffInvite(token, role);
    res.json(result);
  })
);

router.post(
  '/complete-invite',
  asyncHandler(async (req, res) => {
    const body = completeInviteSchema.parse(req.body);
    const result = await staffInviteService.completeStaffInvite(body);
    res.json(result);
  })
);

export default router;
