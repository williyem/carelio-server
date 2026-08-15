import express from 'express';
import path from 'path';
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
import healthAssistantsRouter from './modules/health-assistants/health-assistants.routes';
import doctorsRouter from './modules/doctors/doctors.routes';
import statsRouter from './modules/stats/stats.routes';
import vitalsRouter from './modules/vitals/vitals.routes';
import uploadRouter from './modules/upload/upload.routes';
import adminRouter from './modules/admin/admin.routes';
import deviceGuidesRouter from './modules/device-guides/device-guides.routes';
import devRouter from './modules/dev/dev.routes';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

  if (env.NODE_ENV !== 'production') {
    app.use('/dev', devRouter);
  }

  app.use('/auth', authRouter);
  app.use('/patients', patientsRouter);
  app.use('/appointments', appointmentsRouter);
  app.use('/consultations', consultationsRouter);
  app.use('/doctor', doctorRouter);
  app.use('/health-assistant', healthAssistantRouter);
  app.use('/health-assistants', healthAssistantsRouter);
  app.use('/doctors', doctorsRouter);
  app.use('/stats', statsRouter);
  app.use('/vitals', vitalsRouter);
  app.use('/upload', uploadRouter);
  app.use('/admin', adminRouter);
  app.use('/device-guides', deviceGuidesRouter);

  app.use(errorHandler);

  logger.info('Express app configured', {
    cors: env.CORS_ORIGIN,
    env: env.NODE_ENV,
  });

  return app;
}
