import { env } from './config/env';
import { connectDatabase } from './config/database';
import { redis } from './config/redis';
import { createApp } from './app';
import { reconcileQueueOnStartup } from './services/recovery.service';
import { reconcileElasticsearchIndex } from './services/elasticsearch.service';
import { logger } from './utils/logger';
import './queue/email.worker';

async function bootstrap() {
  const app = createApp();
  app.listen(Number(env.PORT), '0.0.0.0', () => {
    logger.info(`Express API server listening on http://0.0.0.0:${env.PORT}`);
  });

  await connectDatabase();
  await redis.ping();
  await reconcileQueueOnStartup();

  reconcileElasticsearchIndex().catch((err) => {
    logger.warn('Elasticsearch unavailable, skipping index reconciliation', err);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start Express API server', err);
  process.exit(1);
});