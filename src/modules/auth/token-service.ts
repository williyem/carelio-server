import { Types } from 'mongoose';
import { RefreshToken } from '../../models';
import {
  createRefreshTokenValue,
  refreshExpiresAt,
  signAccessToken,
  UserRole,
} from '../../utils/tokens';
import { hashToken } from '../../utils/passwords';
import { AppError } from '../../utils/errors';

export async function issueTokenPair(userId: string, role: UserRole) {
  const access = signAccessToken(userId, role);
  const refreshValue = createRefreshTokenValue();
  const expiresAt = refreshExpiresAt();

  await RefreshToken.create({
    tokenHash: hashToken(refreshValue),
    userId: new Types.ObjectId(userId),
    role,
    expiresAt,
  });

  return {
    tokenData: {
      access: {
        token: access.token,
        expires: access.expires,
      },
      refresh: {
        token: refreshValue,
        expires: expiresAt.toISOString(),
      },
    },
  };
}

export async function rotateRefreshToken(refreshToken: string, role: UserRole) {
  const tokenHash = hashToken(refreshToken);
  const existing = await RefreshToken.findOne({ tokenHash, role });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new AppError('Invalid refresh token', 401);
  }

  existing.revokedAt = new Date();
  await existing.save();

  const pair = await issueTokenPair(existing.userId.toString(), role);

  return {
    accessToken: pair.tokenData.access.token,
    refreshToken: pair.tokenData.refresh.token,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.updateOne(
    { tokenHash },
    { $set: { revokedAt: new Date() } }
  );
}

export async function revokeAllUserTokens(
  userId: string,
  role: UserRole
): Promise<void> {
  await RefreshToken.updateMany(
    { userId: new Types.ObjectId(userId), role, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}
