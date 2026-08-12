import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export type UserRole = 'doctor' | 'patient' | 'healthAssistant';

export type TempPurpose = '2fa' | 'setup' | 'reset';

export interface AccessPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export interface TempPayload {
  sub: string;
  role: UserRole;
  type: 'temp';
  purpose: TempPurpose;
}

function expiresAtFromDuration(duration: string): Date {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const mult =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  return new Date(Date.now() + value * mult);
}

export function signAccessToken(sub: string, role: UserRole): {
  token: string;
  expires: string;
} {
  const expires = expiresAtFromDuration(env.JWT_ACCESS_EXPIRES_IN);
  const token = jwt.sign(
    { sub, role, type: 'access' } satisfies AccessPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
  return { token, expires: expires.toISOString() };
}

export function signTempToken(
  sub: string,
  role: UserRole,
  purpose: TempPurpose
): string {
  return jwt.sign(
    { sub, role, type: 'temp', purpose } satisfies TempPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_TEMP_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid access token');
  }
  return payload;
}

export function verifyTempToken(
  token: string,
  purpose?: TempPurpose
): TempPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TempPayload;
  if (payload.type !== 'temp') {
    throw new Error('Invalid temp token');
  }
  if (purpose && payload.purpose !== purpose) {
    throw new Error('Invalid token purpose');
  }
  return payload;
}

export function createRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function refreshExpiresAt(): Date {
  return expiresAtFromDuration(env.JWT_REFRESH_EXPIRES_IN);
}

export function accessExpiresAt(): Date {
  return expiresAtFromDuration(env.JWT_ACCESS_EXPIRES_IN);
}
