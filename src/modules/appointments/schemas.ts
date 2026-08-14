import { z } from 'zod';

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z
    .enum([
      'PENDING_CONFIRMATION',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'MISSED',
    ])
    .optional(),
  upcoming: z.enum(['true', 'false']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  isImmediate: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  doctorId: z.string().optional(),
});

export const rescheduleSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  reschedulingReason: z.string().optional(),
});

export const cancelSchema = z.object({
  cancellationReason: z.string().min(1),
});
