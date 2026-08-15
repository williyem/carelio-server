import { Model, Document } from 'mongoose';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { AppError } from '../../utils/errors';
import {
  generateOtp,
  generateRecoveryCodes,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../utils/passwords';
import {
  signTempToken,
  verifyTempToken,
  UserRole,
} from '../../utils/tokens';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
} from './token-service';
import { serializeStaffProfile } from '../../utils/staff-profile';
import { sendPasswordResetOtpEmail } from '../mail/resend';

export interface StaffDoc extends Document {
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  twoFactorEnabled: boolean;
  twoFactorMethod?: 'totp' | 'email';
  totpSecret?: string;
  pendingTotpSecret?: string;
  recoveryCodes: string[];
  isActive: boolean;
  isAdmin?: boolean;
  resetOtpHash?: string;
  resetOtpExpiresAt?: Date;
  mustResetPassword?: boolean;
  emailVerified?: boolean;
  invitationTokenHash?: string;
  invitationExpiresAt?: Date;
  avatarUrl?: string;
  title?: string;
  specialty?: string;
  clinicName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  timezone?: string;
  npi?: string;
  licenseNumber?: string;
  onboardingCompletedAt?: Date | null;
  signedAgreementUrl?: string;
  signedName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toStaffUser(user: StaffDoc) {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorMethod: user.twoFactorMethod,
    isActive: user.isActive,
    isAdmin: Boolean(user.isAdmin),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    ...serializeStaffProfile(user),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createStaffAuthService(opts: {
  // mongoose model typing is loose here so Doctor/HealthAssistant both work
  model: Model<any>;
  role: UserRole;
  issuerLabel: string;
}) {
  const { model, role, issuerLabel } = opts;

  async function register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  }) {
    const existing = await model.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const user = (await model.create({
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
    })) as StaffDoc;

    const tokens = await issueTokenPair(user._id.toString(), role);
    return { ...tokens, user: toStaffUser(user) };
  }

  async function login(email: string, password: string) {
    const user = (await model.findOne({
      email: email.toLowerCase(),
    })) as StaffDoc | null;
    if (!user?.passwordHash) {
      throw new AppError(
        'Complete your invite onboarding before signing in',
        403
      );
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new AppError('Invalid email or password', 401);
    }
    if (!user.isActive) {
      throw new AppError('Account is inactive', 403);
    }
    if (user.invitationTokenHash) {
      throw new AppError(
        'Complete your invite onboarding before signing in',
        403
      );
    }

    if (user.mustResetPassword) {
      return {
        requiresPasswordReset: true,
        resetToken: signTempToken(user._id.toString(), role, 'reset'),
      };
    }

    // 2FA is temporarily disabled so login issues a session immediately.
    // if (user.twoFactorEnabled) {
    //   return {
    //     requires2FA: true,
    //     token: signTempToken(user._id.toString(), role, '2fa'),
    //   };
    // }

    const tokens = await issueTokenPair(user._id.toString(), role);
    return { ...tokens, user: toStaffUser(user) };
  }

  async function verify2FA(token: string, code: string) {
    const payload = verifyTempToken(token, '2fa');
    if (payload.role !== role) {
      throw new AppError('Invalid token', 401);
    }

    const user = (await model.findById(payload.sub)) as StaffDoc | null;
    if (!user || !user.twoFactorEnabled) {
      throw new AppError('Invalid token', 401);
    }

    const totpOk =
      !!user.totpSecret &&
      verifySync({ secret: user.totpSecret, token: code }).valid;

    const codeHash = hashToken(code.toUpperCase());
    const recoveryIndex = user.recoveryCodes.findIndex(
      (stored) => stored === codeHash
    );

    if (!totpOk && recoveryIndex === -1) {
      throw new AppError('Invalid verification code', 401);
    }

    if (!totpOk && recoveryIndex !== -1) {
      user.recoveryCodes.splice(recoveryIndex, 1);
      await user.save();
    }

    const tokens = await issueTokenPair(user._id.toString(), role);
    return { ...tokens, user: toStaffUser(user) };
  }

  async function forgotPassword(email: string) {
    const user = (await model.findOne({
      email: email.toLowerCase(),
    })) as StaffDoc | null;
    if (user) {
      const otp = generateOtp(6);
      user.resetOtpHash = hashToken(otp);
      user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      console.log(
        `[dev] ${issuerLabel} password reset OTP for ${email}: ${otp}`
      );
      try {
        await sendPasswordResetOtpEmail({ to: email.toLowerCase(), otp });
      } catch (err) {
        console.error(
          `[mail] Password reset email failed for ${email}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    return { message: 'If that email exists, an OTP has been sent' };
  }

  async function verifyResetOtp(email: string, otp: string) {
    const user = (await model.findOne({
      email: email.toLowerCase(),
    })) as StaffDoc | null;
    if (
      !user ||
      !user.resetOtpHash ||
      !user.resetOtpExpiresAt ||
      user.resetOtpExpiresAt < new Date() ||
      user.resetOtpHash !== hashToken(otp)
    ) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    await user.save();

    return {
      token: signTempToken(user._id.toString(), role, 'reset'),
      message: 'OTP verified',
    };
  }

  async function resetPassword(tempToken: string | undefined, password: string) {
    if (!tempToken) {
      throw new AppError('Reset token required', 401);
    }
    const payload = verifyTempToken(tempToken, 'reset');
    if (payload.role !== role) {
      throw new AppError('Invalid token', 401);
    }

    const user = (await model.findById(payload.sub)) as StaffDoc | null;
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.passwordHash = await hashPassword(password);
    user.mustResetPassword = false;
    await user.save();
    await revokeAllUserTokens(user._id.toString(), role);

    // 2FA is temporarily disabled — issue a session instead of a setup token.
    // const setupToken = signTempToken(user._id.toString(), role, 'setup');
    // return { requiresSetup: true, setupToken };
    const tokens = await issueTokenPair(user._id.toString(), role);
    return { ...tokens, user: toStaffUser(user) };
  }

  async function refresh(refreshToken: string) {
    return rotateRefreshToken(refreshToken, role);
  }

  async function logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    } else if (userId) {
      await revokeAllUserTokens(userId, role);
    }
    return { message: 'Logged out successfully' };
  }

  async function session(userId: string) {
    const user = (await model.findById(userId)) as StaffDoc | null;
    if (!user || !user.isActive) {
      throw new AppError('Unauthorized', 401);
    }
    return { user: toStaffUser(user) };
  }

  async function changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    const user = (await model.findById(userId)) as StaffDoc | null;
    if (!user) {
      throw new AppError('Unauthorized', 401);
    }
    if (!user.passwordHash || !(await verifyPassword(oldPassword, user.passwordHash))) {
      throw new AppError('Current password is incorrect', 400);
    }
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await revokeAllUserTokens(userId, role);
    return { message: 'Password changed successfully' };
  }

  async function setup2FA(userId: string, method: 'totp' | 'email') {
    const user = (await model.findById(userId)) as StaffDoc | null;
    if (!user) {
      throw new AppError('Unauthorized', 401);
    }

    if (method === 'email') {
      return {
        message: 'Email 2FA is not enabled in this environment. Use TOTP.',
      };
    }

    const secret = generateSecret();
    user.pendingTotpSecret = secret;
    user.twoFactorMethod = 'totp';
    await user.save();

    const otpauth = generateURI({
      issuer: 'Carelio',
      label: user.email,
      secret,
    });
    const qrCode = await QRCode.toDataURL(otpauth);

    return {
      qrCode,
      secret,
      message: 'Scan the QR code with your authenticator app',
    };
  }

  async function enable2FA(userId: string, code: string) {
    const user = (await model.findById(userId)) as StaffDoc | null;
    if (!user || !user.pendingTotpSecret) {
      throw new AppError('2FA setup not started', 400);
    }

    const result = verifySync({ secret: user.pendingTotpSecret, token: code });
    if (!result.valid) {
      throw new AppError('Invalid verification code', 400);
    }

    const plainCodes = generateRecoveryCodes(8);
    user.totpSecret = user.pendingTotpSecret;
    user.pendingTotpSecret = undefined;
    user.twoFactorEnabled = true;
    user.twoFactorMethod = 'totp';
    user.recoveryCodes = plainCodes.map((c) => hashToken(c));
    await user.save();

    return {
      message: '2FA enabled successfully',
      recoveryCodes: plainCodes,
    };
  }

  async function disable2FA(userId: string, password: string) {
    const user = (await model.findById(userId)) as StaffDoc | null;
    if (!user) {
      throw new AppError('Unauthorized', 401);
    }
    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError('Password is incorrect', 400);
    }

    user.twoFactorEnabled = false;
    user.totpSecret = undefined;
    user.pendingTotpSecret = undefined;
    user.recoveryCodes = [];
    user.twoFactorMethod = undefined;
    await user.save();

    return { message: '2FA disabled successfully' };
  }

  async function regenerateRecoveryCodes(userId: string, password: string) {
    const user = (await model.findById(userId)) as StaffDoc | null;
    if (!user) {
      throw new AppError('Unauthorized', 401);
    }
    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError('Password is incorrect', 400);
    }
    if (!user.twoFactorEnabled) {
      throw new AppError('2FA is not enabled', 400);
    }

    const plainCodes = generateRecoveryCodes(8);
    user.recoveryCodes = plainCodes.map((c) => hashToken(c));
    await user.save();

    return { recoveryCodes: plainCodes };
  }

  return {
    register,
    login,
    verify2FA,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    refresh,
    logout,
    session,
    changePassword,
    setup2FA,
    enable2FA,
    disable2FA,
    regenerateRecoveryCodes,
  };
}
