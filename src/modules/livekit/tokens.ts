import { AccessToken } from 'livekit-server-sdk';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

export function isLiveKitConfigured() {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

export async function mintLiveKitToken(input: {
  identity: string;
  name?: string;
  roomName: string;
}) {
  if (!isLiveKitConfigured()) {
    throw new AppError(
      'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.',
      503
    );
  }

  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: input.identity,
    name: input.name ?? input.identity,
    ttl: '6h',
  });

  token.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  });

  return {
    token: await token.toJwt(),
    url: env.LIVEKIT_URL,
  };
}
