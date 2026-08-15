import { createApp } from './app';
import { connectDb } from './db/connect';
import { env } from './config/env';
import { logger } from './utils/logger';
import { expireAppointmentStatuses } from './modules/appointments/appointments.service';

const EXPIRE_INTERVAL_MS = 5 * 60 * 1000;

async function runStatusExpire() {
  try {
    const result = await expireAppointmentStatuses();
    if (result.completed || result.missed) {
      logger.info('Expired appointment statuses', result);
    }
  } catch (err) {
    logger.error('Failed to expire appointment statuses', err);
  }
}

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Carelio backend listening on http://localhost:${env.PORT}`);
  });

  await runStatusExpire();
  setInterval(() => {
    void runStatusExpire();
  }, EXPIRE_INTERVAL_MS);
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
