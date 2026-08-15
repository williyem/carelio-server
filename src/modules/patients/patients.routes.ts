import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import {
  searchQuerySchema,
  registerPatientSchema,
  updatePatientSchema,
  verifyCodeSchema,
} from './schemas';
import { consentAgreementsSchema } from '../auth/schemas';
import * as patientsService from './patients.service';
import { saveAgreements, saveAuthenticatedAgreements } from '../auth/patient-auth.service';
import patientAppointmentsRouter from '../appointments/patient-appointments.routes';
import * as notesService from '../notes/notes.service';
import * as accessService from '../access/access.service';
import * as billingService from '../billing/billing.service';
import { z } from 'zod';
import { Patient } from '../../models';
import { AppError } from '../../utils/errors';
import { serializePatient } from '../../serializers/patient.serializer';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');
const patientAuth = requireAuth('patient');
const notesAuth = requireAuth('doctor', 'healthAssistant');

const insuranceSchema = z.object({
  provider: z.string().min(1),
  memberId: z.string().min(1),
  groupId: z.string().optional(),
  holderName: z.string().optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  isDefault: z.boolean().optional(),
  cardImageUrl: z.string().optional(),
});

const grantSchema = z.object({
  granteeId: z.string().min(1),
  granteeRole: z.enum(['doctor', 'health-assistant']),
});

const mePatchSchema = z.object({
  avatarUrl: z.string().optional(),
  fullName: z.string().optional(),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodType: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .optional(),
  allergies: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  isRegistrationComplete: z.boolean().optional(),
});

const meAgreementsSchema = z.object({
  agreements: z
    .array(
      z.object({
        type: z.string().min(1),
        signatureUrl: z.string().min(1),
        documentUrl: z.string().min(1),
      })
    )
    .min(1),
});

router.get(
  '/',
  staffAuth,
  asyncHandler(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    const result = await patientsService.listPatients(query, req.auth);
    res.json(result);
  })
);

router.get(
  '/assigned',
  staffAuth,
  asyncHandler(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    const result = await patientsService.listAssignedPatients({
      ...query,
      callerId: req.auth!.id,
      callerRole: req.auth!.role,
    });
    res.json(result);
  })
);

router.post(
  '/agreements',
  asyncHandler(async (req, res) => {
    const body = consentAgreementsSchema.parse(req.body);
    const result = await saveAgreements(body);
    res.json(result);
  })
);

router.post(
  '/consent/agree',
  asyncHandler(async (req, res) => {
    const tokenFromQuery =
      typeof req.query.token === 'string' ? req.query.token : undefined;
    const body = consentAgreementsSchema.parse({
      ...req.body,
      token: req.body?.token || tokenFromQuery,
    });
    const result = await saveAgreements(body);
    res.json(result);
  })
);

router.post(
  '/',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = registerPatientSchema.parse(req.body);
    const result = await patientsService.registerPatient(body, req.auth!);
    res.status(201).json(result);
  })
);

router.get(
  '/me',
  patientAuth,
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.auth!.id);
    if (!patient) throw new AppError('Patient not found', 404);
    res.json(serializePatient(patient));
  })
);

router.patch(
  '/me',
  patientAuth,
  asyncHandler(async (req, res) => {
    const body = mePatchSchema.parse(req.body);
    const result = await patientsService.updatePatient(req.auth!.id, {
      ...body,
    });
    res.json(result);
  })
);

router.post(
  '/me/agreements',
  patientAuth,
  asyncHandler(async (req, res) => {
    const body = meAgreementsSchema.parse(req.body);
    const result = await saveAuthenticatedAgreements(
      req.auth!.id,
      body.agreements
    );
    res.json(result);
  })
);

router.get(
  '/me/insurance',
  patientAuth,
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.auth!.id);
    if (!patient) throw new AppError('Patient not found', 404);
    res.json(serializePatient(patient).insurance);
  })
);

router.post(
  '/me/insurance',
  patientAuth,
  asyncHandler(async (req, res) => {
    const body = insuranceSchema.parse(req.body);
    const patient = await Patient.findById(req.auth!.id);
    if (!patient) throw new AppError('Patient not found', 404);
    if (body.isDefault || patient.insurance.length === 0) {
      patient.insurance.forEach((policy) => {
        policy.isDefault = false;
      });
    }
    patient.insurance.push({
      provider: body.provider,
      memberId: body.memberId,
      groupId: body.groupId || '',
      holderName: body.holderName || '',
      effectiveDate: body.effectiveDate || '',
      expirationDate: body.expirationDate || '',
      isDefault: body.isDefault ?? patient.insurance.length === 0,
      cardImageUrl: body.cardImageUrl || '',
    });
    await patient.save();
    res.status(201).json(serializePatient(patient).insurance);
  })
);

router.delete(
  '/me/insurance/:policyId',
  patientAuth,
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.auth!.id);
    if (!patient) throw new AppError('Patient not found', 404);
    patient.insurance = patient.insurance.filter(
      (policy) => policy._id?.toString() !== param(req.params.policyId)
    );
    await patient.save();
    res.json(serializePatient(patient).insurance);
  })
);

router.get(
  '/me/access-grants',
  patientAuth,
  asyncHandler(async (req, res) => {
    const result = await accessService.listGrants(req.auth!.id);
    res.json(result);
  })
);

router.post(
  '/me/access-grants',
  patientAuth,
  asyncHandler(async (req, res) => {
    const body = grantSchema.parse(req.body);
    const result = await accessService.grantAccess(
      req.auth!.id,
      body.granteeId,
      body.granteeRole
    );
    res.status(201).json(result);
  })
);

router.delete(
  '/me/access-grants/:granteeId',
  patientAuth,
  asyncHandler(async (req, res) => {
    const result = await accessService.revokeAccess(
      req.auth!.id,
      param(req.params.granteeId)
    );
    res.json(result);
  })
);

router.get(
  '/me/billing',
  patientAuth,
  asyncHandler(async (req, res) => {
    const result = await billingService.getBilling(req.auth!.id, 'patient');
    res.json(result);
  })
);

router.get(
  '/doctor-requests/:token',
  asyncHandler(async (req, res) => {
    const result = await accessService.getDoctorAccessRequest(
      param(req.params.token)
    );
    res.json(result);
  })
);

router.post(
  '/doctor-requests/:token/approve',
  asyncHandler(async (req, res) => {
    const result = await accessService.resolveDoctorAccessRequest(
      param(req.params.token),
      'approved'
    );
    res.json(result);
  })
);

router.post(
  '/doctor-requests/:token/decline',
  asyncHandler(async (req, res) => {
    const result = await accessService.resolveDoctorAccessRequest(
      param(req.params.token),
      'declined'
    );
    res.json(result);
  })
);

router.post(
  '/:id/doctor-requests',
  requireAuth('healthAssistant'),
  asyncHandler(async (req, res) => {
    const body = z.object({ doctorId: z.string().min(1) }).parse(req.body);
    const result = await accessService.createDoctorAccessRequest(
      param(req.params.id),
      body.doctorId,
      req.auth!.id
    );
    res.status(201).json(result);
  })
);

router.get(
  '/:patientId/notes',
  notesAuth,
  asyncHandler(async (req, res) => {
    await patientsService.requirePatientAccess(
      param(req.params.patientId),
      req.auth!
    );
    const query = searchQuerySchema.parse(req.query);
    const result = await notesService.listPatientNotes(
      param(req.params.patientId),
      query,
      req.auth?.role
    );
    res.json(result);
  })
);

router.use('/:patientId/appointments', patientAppointmentsRouter);

router.get(
  '/:id',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await patientsService.getPatient(
      param(req.params.id),
      req.auth
    );
    res.json(result);
  })
);

router.patch(
  '/:id',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = updatePatientSchema.parse(req.body);
    const result = await patientsService.updatePatient(param(req.params.id), body);
    res.json(result);
  })
);

router.delete(
  '/:id',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await patientsService.softDeletePatient(param(req.params.id));
    res.json(result);
  })
);

router.post(
  '/:id/verify/email',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await patientsService.startVerify(
      param(req.params.id),
      'email'
    );
    res.json(result);
  })
);

router.post(
  '/:id/verify/code',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = verifyCodeSchema.parse(req.body);
    const result = await patientsService.confirmVerify(
      param(req.params.id),
      body.code,
      body.type,
      req.auth
    );
    res.json(result);
  })
);

export default router;
