import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import authRouter from './modules/auth';
import { patientsRouter } from './modules/patients';
import {
  appointmentsRouter,
  consultationsRouter,
} from './modules/appointments';
import doctorRouter from './modules/doctor/doctor.routes';
import healthAssistantRouter from './modules/health-assistant/health-assistant.routes';
import statsRouter from './modules/stats/stats.routes';
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

  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: {
        write: (msg: string) => process.stdout.write(msg),
      },
    })
  );

  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'carelio-backend' });
  });

  app.use('/auth', authRouter);
  app.use('/patients', patientsRouter);
  app.use('/appointments', appointmentsRouter);
  app.use('/consultations', consultationsRouter);
  app.use('/doctor', doctorRouter);
  app.use('/health-assistant', healthAssistantRouter);
  app.use('/stats', statsRouter);

  app.use(errorHandler);

  logger.info('Express app configured', {
    cors: env.CORS_ORIGIN,
    env: env.NODE_ENV,
  });

  return app;
}
