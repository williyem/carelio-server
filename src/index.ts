import { createApp } from './app';
import { connectDb } from './db/connect';
import { env } from './config/env';
import { logger } from './utils/logger';

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Carelio backend listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
