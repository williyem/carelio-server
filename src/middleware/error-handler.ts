import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    logger.warn(`Validation failed ${req.method} ${req.originalUrl}`, err.flatten());
    res.status(400).json({
      message: 'Validation failed',
      details: err.flatten(),
    });
    return;
  }

  if (isAppError(err)) {
    logger.warn(`${err.message} ${req.method} ${req.originalUrl}`, {
      statusCode: err.statusCode,
      details: err.details,
    });
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
    return;
  }

  logger.error(`Unhandled error ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ message: 'Internal server error' });
}
