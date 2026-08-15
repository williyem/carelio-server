import { Doctor, HealthAssistant } from '../../models';
import { AppError } from '../../utils/errors';
import { hashPassword, hashToken } from '../../utils/passwords';
import {
  applyStaffProfilePatch,
  serializeStaffProfile,
} from '../../utils/staff-profile';

export type StaffInviteRole = 'doctor' | 'health-assistant';

function authRole(role: StaffInviteRole) {
  return role === 'doctor' ? 'doctor' : 'healthAssistant';
}

async function findByInviteToken(token: string, role: StaffInviteRole) {
  const tokenHash = hashToken(token);
  if (role === 'doctor') {
    const user = await Doctor.findOne({ invitationTokenHash: tokenHash });
    if (!user || !user.isActive) {
      throw new AppError('This invite link is invalid or has expired', 404);
    }
    if (
      user.invitationExpiresAt &&
      user.invitationExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError('This invite link has expired', 410);
    }
    return user;
  }

  const user = await HealthAssistant.findOne({
    invitationTokenHash: tokenHash,
  });
  if (!user || !user.isActive) {
    throw new AppError('This invite link is invalid or has expired', 404);
  }
  if (
    user.invitationExpiresAt &&
    user.invitationExpiresAt.getTime() < Date.now()
  ) {
    throw new AppError('This invite link has expired', 410);
  }
  return user;
}

export async function verifyStaffInvite(token: string, role: StaffInviteRole) {
  const user = await findByInviteToken(token, role);
  return {
    role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    ...serializeStaffProfile(user),
  };
}

export async function completeStaffInvite(input: {
  token: string;
  role: StaffInviteRole;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
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
  signedName: string;
  signedAgreementUrl?: string;
}) {
  const user = await findByInviteToken(input.token, input.role);

  if (input.password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }
  if (!input.signedName?.trim()) {
    throw new AppError('Signature name is required', 400);
  }

  applyStaffProfilePatch(user, {
    firstName: input.firstName ?? user.firstName,
    lastName: input.lastName ?? user.lastName,
    phoneNumber: input.phoneNumber ?? user.phoneNumber,
    title: input.title,
    specialty: input.specialty,
    clinicName: input.clinicName,
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    timezone: input.timezone,
    npi: input.npi,
    licenseNumber: input.licenseNumber,
  });

  user.passwordHash = await hashPassword(input.password);
  user.emailVerified = true;
  user.mustResetPassword = false;
  user.signedName = input.signedName.trim();
  if (input.signedAgreementUrl) {
    user.signedAgreementUrl = input.signedAgreementUrl;
  }
  user.onboardingCompletedAt = new Date();
  user.invitationTokenHash = undefined;
  user.invitationExpiresAt = undefined;
  await user.save();

  return {
    message: 'Onboarding completed. You can now log in.',
    role: authRole(input.role),
    email: user.email,
  };
}
