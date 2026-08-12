import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { verifyAccessToken, UserRole } from '../utils/tokens';

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
