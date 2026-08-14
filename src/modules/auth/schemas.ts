import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(5),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verify2FASchema = z.object({
  token: z.string().min(1),
  code: z.string().min(4),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const setup2FASchema = z.object({
  method: z.enum(['totp', 'email']).default('totp'),
});

export const enable2FASchema = z.object({
  code: z.string().min(4),
});

export const disable2FASchema = z.object({
  password: z.string().min(1),
});

export const regenerateRecoverySchema = z.object({
  password: z.string().min(1),
});

export const patientLoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const patientVerifyLoginEmailSchema = z.object({
  patientId: z.string().min(1),
  otp: z.string().min(4),
});

export const patientForgotPasswordSchema = z.object({
  identifier: z.string().min(1),
});

export const patientResetPasswordSchema = z.object({
  identifier: z.string().min(1),
  otp: z.string().min(4),
  password: z.string().min(8),
});

export const completeRegistrationSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1),
  dob: z.string().min(1),
  gender: z.enum(['male', 'female', 'other']),
  phoneNumber: z.string().min(5),
  address: z.string().min(1),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

export const consentAgreementsSchema = z.object({
  token: z.string().min(1),
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
