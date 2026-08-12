import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const started = Date.now();
  const { method, originalUrl } = req;

  logger.info(`→ ${method} ${originalUrl}`, {
    ip: req.ip,
    body:
      method === 'GET' || method === 'HEAD'
        ? undefined
        : sanitizeBody(req.body),
  });

  res.on('finish', () => {
    const ms = Date.now() - started;
    const level =
      res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
          ? 'warn'
          : 'info';
    logger[level](`← ${method} ${originalUrl} ${res.statusCode} ${ms}ms`);
  });

  next();
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(clone)) {
    if (/password|secret|token|otp/i.test(key) && typeof clone[key] === 'string') {
      clone[key] = '[redacted]';
    }
  }
  return clone;
}
