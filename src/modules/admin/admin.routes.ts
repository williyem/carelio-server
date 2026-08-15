import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { param } from '../../utils/params';
import { createStaffSchema, setActiveSchema } from './schemas';
import * as adminService from './admin.service';
import * as deviceGuidesService from '../device-guides/device-guides.service';
import {
  deviceGuideCreateSchema,
  deviceGuidePatchSchema,
} from '../device-guides/device-guides.routes';
const router = Router();
const adminAuth = [requireAuth('doctor'), requireAdmin];

router.get(
  '/doctors',
  ...adminAuth,
  asyncHandler(async (_req, res) => {
    const result = await adminService.listDoctors();
    res.json(result);
  })
);

router.post(
  '/doctors',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const body = createStaffSchema.parse(req.body);
    const result = await adminService.createDoctor(body);
    res.status(201).json(result);
  })
);

router.patch(
  '/doctors/:id/active',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const body = setActiveSchema.parse(req.body);
    const result = await adminService.setDoctorActive(
      param(req.params.id),
      body.isActive,
      req.auth!.id
    );
    res.json(result);
  })
);

router.get(
  '/health-assistants',
  ...adminAuth,
  asyncHandler(async (_req, res) => {
    const result = await adminService.listHealthAssistants();
    res.json(result);
  })
);

router.post(
  '/health-assistants',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const body = createStaffSchema.parse(req.body);
    const result = await adminService.createHealthAssistant(body);
    res.status(201).json(result);
  })
);

router.patch(
  '/health-assistants/:id/active',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const body = setActiveSchema.parse(req.body);
    const result = await adminService.setHealthAssistantActive(
      param(req.params.id),
      body.isActive
    );
    res.json(result);
  })
);

router.get(
  '/patients',
  ...adminAuth,
  asyncHandler(async (_req, res) => {
    const result = await adminService.listPatients();
    res.json(result);
  })
);

router.patch(
  '/patients/:id/active',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const body = setActiveSchema.parse(req.body);
    const result = await adminService.setPatientActive(
      param(req.params.id),
      body.isActive
    );
    res.json(result);
  })
);

router.get(
  '/device-guides',
  ...adminAuth,
  asyncHandler(async (_req, res) => {
    const guides = await deviceGuidesService.listAllDeviceGuides();
    res.json({ guides });
  })
);

router.post(
  '/device-guides',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const body = deviceGuideCreateSchema.parse(req.body);
    const guide = await deviceGuidesService.createDeviceGuide(body);
    res.status(201).json({ guide });
  })
);

router.patch(
  '/device-guides/:slug',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const slug = param(req.params.slug);
    const body = deviceGuidePatchSchema.parse(req.body);
    const guide = await deviceGuidesService.updateDeviceGuide(slug, body);
    res.json({ guide });
  })
);

router.delete(
  '/device-guides/:slug',
  ...adminAuth,
  asyncHandler(async (req, res) => {
    const slug = param(req.params.slug);
    const result = await deviceGuidesService.deleteDeviceGuide(slug);
    res.json(result);
  })
);

export default router;
