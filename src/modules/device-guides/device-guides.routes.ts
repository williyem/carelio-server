import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/auth';
import * as deviceGuidesService from './device-guides.service';

const router = Router();

router.get(
  '/',
  requireAuth('doctor', 'healthAssistant', 'patient'),
  asyncHandler(async (_req, res) => {
    const guides = await deviceGuidesService.listActiveDeviceGuides();
    res.json({ guides });
  })
);

export default router;

export const deviceGuidePatchSchema = z.object({
  title: z.string().min(1).optional(),
  shortLabel: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  tips: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const deviceGuideCreateSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase letters, numbers, and hyphens'
    ),
  title: z.string().min(1),
  shortLabel: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  tips: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});
