import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import { Doctor } from '../../models';
import { AppError } from '../../utils/errors';
import { toStaffUser } from '../auth/staff-auth.service';
import { applyStaffProfilePatch } from '../../utils/staff-profile';
import * as availabilityService from '../availability/availability.service';
import * as billingService from '../billing/billing.service';

const router = Router();
const doctorAuth = requireAuth('doctor');

const profilePatchSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phoneNumber: z.string().optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().optional(),
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
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const availabilitySchema = z.object({
  timezone: z.string().optional(),
  enabled: z.boolean().optional(),
  days: z
    .record(
      z.string(),
      z.array(z.object({ start: z.string(), end: z.string() }))
    )
    .optional(),
});

const onboardingSchema = z.object({
  signedName: z.string().min(1),
  signedAgreementUrl: z.string().optional(),
});

const billingPatchSchema = z.object({
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
  card: z
    .object({
      brand: z.string().optional(),
      last4: z.string().optional(),
      expMonth: z.string().optional(),
      expYear: z.string().optional(),
      nameOnCard: z.string().optional(),
    })
    .optional(),
  entitledAmount: z.string().optional(),
});

router.get(
  '/profile',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const doctor = await Doctor.findById(req.auth!.id);
    if (!doctor || !doctor.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    res.json(toStaffUser(doctor));
  })
);

router.patch(
  '/profile',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const body = profilePatchSchema.parse(req.body);
    const doctor = await Doctor.findById(req.auth!.id);
    if (!doctor || !doctor.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    applyStaffProfilePatch(doctor, body);
    await doctor.save();
    res.json(toStaffUser(doctor));
  })
);

router.get(
  '/availability',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const result = await availabilityService.getAvailability(
      req.auth!.id,
      date
    );
    res.json(result);
  })
);

router.put(
  '/availability',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const body = availabilitySchema.parse(req.body);
    const result = await availabilityService.updateAvailability(
      req.auth!.id,
      body
    );
    res.json(result);
  })
);

router.post(
  '/onboarding/complete',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const body = onboardingSchema.parse(req.body);
    const doctor = await Doctor.findById(req.auth!.id);
    if (!doctor || !doctor.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    applyStaffProfilePatch(doctor, req.body);
    doctor.signedName = body.signedName;
    if (body.signedAgreementUrl) {
      doctor.signedAgreementUrl = body.signedAgreementUrl;
    }
    doctor.onboardingCompletedAt = new Date();
    await doctor.save();
    res.json(toStaffUser(doctor));
  })
);

router.get(
  '/billing',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const result = await billingService.getBilling(req.auth!.id, 'doctor');
    res.json(result);
  })
);

router.patch(
  '/billing',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const body = billingPatchSchema.parse(req.body);
    const result = await billingService.updateDoctorBilling(req.auth!.id, body);
    res.json(result);
  })
);

export default router;
