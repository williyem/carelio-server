import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { verifyAccessToken, UserRole } from '../utils/tokens';
import { env } from '../config/env';
import { Doctor } from '../models/Doctor';
import { asyncHandler } from '../utils/async-handler';

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function requireAuth(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new AppError('Unauthorized', 401);
      }
      const token = header.slice(7);
      const payload = verifyAccessToken(token);
      if (roles.length && !roles.includes(payload.role)) {
        throw new AppError('Forbidden', 403);
      }
      req.auth = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new AppError('Unauthorized', 401));
    }
  };
}

export const requireAdmin = asyncHandler(async (req, _res, next) => {
  if (!req.auth || req.auth.role !== 'doctor') {
    throw new AppError('Forbidden', 403);
  }
  const doctor = await Doctor.findById(req.auth.id);
  if (!doctor?.isAdmin || !doctor.isActive) {
    throw new AppError('Forbidden', 403);
  }
  next();
});

export function requireCronSecret(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      next(new AppError('Unauthorized', 401));
      return;
    }
    next();
    return;
  }

  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const headerSecret = req.headers['x-cron-secret'];
  const provided = bearer || (typeof headerSecret === 'string' ? headerSecret : '');

  if (provided !== secret) {
    next(new AppError('Unauthorized', 401));
    return;
  }
  next();
}
