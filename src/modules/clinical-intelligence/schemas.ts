import { z } from 'zod';
import { MEASUREMENT_TYPES } from './measurement-catalog';

export const extractMeasurementsSchema = z.object({
  text: z.string().min(1),
});

export const deviceCaptureSchema = z.object({
  enabled: z.boolean(),
});

export const confirmRequestsSchema = z.object({
  requestIds: z.array(z.string().min(1)).min(1),
});

export const createRequestsSchema = z.object({
  vitalTypes: z
    .array(z.enum(MEASUREMENT_TYPES))
    .min(1),
  source: z.enum(['ai', 'rules', 'manual']).optional(),
});

export const respondRequestSchema = z.object({
  status: z.enum(['acknowledged', 'no_device', 'completed']),
  patientResponse: z.string().optional(),
});
