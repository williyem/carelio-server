import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import authRouter from './modules/auth';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));

  // HTTP access log (method, url, status, timing)
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: {
        write: (msg: string) => process.stdout.write(msg),
      },
    })
  );

  // Structured request body logger (passwords redacted)
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'carelio-backend' });
  });

  app.use('/auth', authRouter);

  app.use(errorHandler);

  logger.info('Express app configured', {
    cors: env.CORS_ORIGIN,
    env: env.NODE_ENV,
  });

  return app;
}
