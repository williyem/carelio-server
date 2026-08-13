import { z } from 'zod';

export const createVitalSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  vitalType: z.enum([
    'thermometer',
    'blood-pressure',
    'pulse-ox',
    'glucose',
    'weight-scale',
    'stethoscope',
    'microscope',
  ]),
  reading: z.record(z.string(), z.unknown()),
  recordedAt: z.string().min(1),
  deviceId: z.string().optional(),
});

export const confirmVitalsSchema = z.object({
  vitalIds: z.array(z.string().min(1)).min(1),
});
