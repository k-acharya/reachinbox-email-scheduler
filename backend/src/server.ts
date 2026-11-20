import { env } from './config/env';
import { connectDatabase } from './config/database';
import { redis } from './config/redis';
import { createApp } from './app';
import { reconcileQueueOnStartup } from './services/recovery.service';
import { reconcileElasticsearchIndex } from './services/elasticsearch.service';
import { logger } from './utils/logger';

async function bootstrap() {
  await connectDatabase();
  await redis.ping();
  await reconcileQueueOnStartup();
  await reconcileElasticsearchIndex();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Express API server listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start Express API server', err);
  process.exit(1);
});