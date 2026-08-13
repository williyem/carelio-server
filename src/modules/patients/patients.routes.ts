import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import {
  searchQuerySchema,
  registerPatientSchema,
  updatePatientSchema,
  assignPatientSchema,
  verifyCodeSchema,
} from './schemas';
import { consentAgreementsSchema } from '../auth/schemas';
import * as patientsService from './patients.service';
import { saveAgreements } from '../auth/patient-auth.service';
import patientAppointmentsRouter from '../appointments/patient-appointments.routes';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');

router.get(
  '/',
  staffAuth,
  asyncHandler(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    const result = await patientsService.listPatients(query);
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

router.get(
  '/unassigned',
  staffAuth,
  asyncHandler(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    const result = await patientsService.listUnassignedPatients(query);
    res.json(result);
  })
);

router.post(
  '/assign',
  staffAuth,
  asyncHandler(async (req, res) => {
    const body = assignPatientSchema.parse(req.body);
    const result = await patientsService.assignPatient(
      body.patientId,
      body.assistantId
    );
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

router.use('/:patientId/appointments', patientAppointmentsRouter);

router.get(
  '/:id',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await patientsService.getPatient(param(req.params.id));
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

router.delete(
  '/:patientId/unassign',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await patientsService.unassignPatient(
      param(req.params.patientId)
    );
    res.json(result);
  })
);

router.post(
  '/:id/verify/phone',
  staffAuth,
  asyncHandler(async (req, res) => {
    const result = await patientsService.startVerify(
      param(req.params.id),
      'phone'
    );
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
      body.type
    );
    res.json(result);
  })
);

export default router;
