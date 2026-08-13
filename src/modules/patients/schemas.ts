import { z } from 'zod';

export const searchQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  assistantId: z.string().optional(),
});

export const registerPatientSchema = z.object({
  fullName: z.string().min(1),
  dob: z.string().min(1),
  gender: z.enum(['male', 'female', 'other']),
  email: z.string().email(),
  phoneNumber: z.string().min(5),
  address: z.string().min(1),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  allergies: z.array(z.string()).optional(),
  chiefComplaint: z.string().optional(),
});

export const updatePatientSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    dob: z.string().min(1).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    email: z.string().email().optional(),
    phoneNumber: z.string().min(5).optional(),
    address: z.string().optional(),
    bloodType: z
      .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
      .optional(),
    allergies: z.array(z.string()).optional(),
    chiefComplaint: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    isRegistrationComplete: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const assignPatientSchema = z.object({
  patientId: z.string().min(1),
  assistantId: z.string().min(1),
});

export const doctorInviteSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z.string().min(5).optional(),
    phone: z.string().min(5).optional(),
  })
  .refine((d) => d.email || d.phoneNumber || d.phone, {
    message: 'email or phoneNumber is required',
  });

export const haInviteSchema = z.object({
  email: z.string().email(),
});

export const verifyCodeSchema = z.object({
  code: z.string().min(4),
  type: z.enum(['phone', 'email']),
});
