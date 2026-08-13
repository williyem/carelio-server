import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { param } from '../../utils/params';
import { requireAuth } from '../../middleware/auth';
import {
  listAppointmentsQuerySchema,
  createAppointmentSchema,
  rescheduleSchema,
  cancelSchema,
} from './schemas';
import * as appointmentsService from './appointments.service';
import * as notesService from '../notes/notes.service';

const router = Router();
const staffAuth = requireAuth('doctor', 'healthAssistant');
const staffOrPatientAuth = requireAuth('doctor', 'healthAssistant', 'patient');
const doctorAuth = requireAuth('doctor');

router.get(
  '/',
  staffAuth,
  asyncHandler(async (req, res) => {
    const query = listAppointmentsQuerySchema.parse(req.query);
    const result = await appointmentsService.listAppointments(query, req.auth!);
    res.json(result);
  })
);

router.get(
  '/upcoming',
  staffAuth,
  asyncHandler(async (req, res) => {
    const query = listAppointmentsQuerySchema.parse(req.query);
    const result = await appointmentsService.listUpcoming(query, req.auth!);
    res.json(result);
  })
);

router.get(
  '/recent',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const result = await appointmentsService.listRecent(req.auth!);
    res.json(result);
  })
);

router.get(
  '/:id/note',
  staffOrPatientAuth,
  asyncHandler(async (req, res) => {
    const result = await notesService.getNoteByAppointment(param(req.params.id));
    res.json(result);
  })
);

router.post(
  '/',
  staffOrPatientAuth,
  asyncHandler(async (req, res) => {
    const body = createAppointmentSchema.parse(req.body);
    const result = await appointmentsService.createAppointment(body, req.auth!);
    res.status(201).json(result);
  })
);

router.patch(
  '/:id/reschedule',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const body = rescheduleSchema.parse(req.body);
    const result = await appointmentsService.rescheduleAppointment(
      param(req.params.id),
      body
    );
    res.json(result);
  })
);

router.patch(
  '/:id/cancel',
  doctorAuth,
  asyncHandler(async (req, res) => {
    const body = cancelSchema.parse(req.body);
    const result = await appointmentsService.cancelAppointment(
      param(req.params.id),
      body.cancellationReason,
      req.auth!
    );
    res.json(result);
  })
);

export default router;
