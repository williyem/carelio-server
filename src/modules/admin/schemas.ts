import { z } from 'zod';

export const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(5),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});
